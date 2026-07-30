import * as fs from "fs";
import * as path from "path";
import {Scene} from "../../../model/scene";
import {PointsPrimitive} from "../../../base/constants";
import {E57Exporter} from "../E57Exporter";
import {E57Loader} from "../E57Loader";
import {readE57, decodeCompressedVector, crc32c, parseE57Header} from "../parser";
import {installE57TestGlobals} from "./installE57TestGlobals";

let restoreGlobals: (() => void) | null = null;

beforeAll(async () => {
  restoreGlobals = await installE57TestGlobals();
});

afterAll(() => {
  restoreGlobals?.();
});

function inRealmArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}

const POSITIONS = [0, 0, 0,  1, 2, 3,  -1, -2, -3,  0.5, 0.5, 0.5];
const COLORS = new Uint8Array([255, 0, 0, 255,  0, 255, 0, 255,  0, 0, 255, 255,  128, 128, 128, 255]);

function pointCloudModel(withColor: boolean) {
  const sm = new Scene().createModel({id: "cloud"}).value!;
  sm.createGeometry({
    id: "g",
    primitive: PointsPrimitive,
    positions: POSITIONS,
    ...(withColor ? {colorsCompressed: COLORS} : {}),
  });
  sm.createMesh({id: "mesh", geometryId: "g"});
  sm.createObject({id: "obj", meshIds: ["mesh"]});
  return sm;
}

describe("E57Exporter", () => {

  it("writes pages with valid big-endian CRC-32C and a correct header", async () => {
    const bytes: Uint8Array = await new E57Exporter().write({sceneModel: pointCloudModel(true)} as any);
    const header = parseE57Header(inRealmArrayBuffer(bytes));
    expect(header.signature).toBe("ASTM-E57");
    expect(header.pageSize).toBe(1024);
    expect(header.filePhysicalLength).toBe(bytes.length);

    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const pages = bytes.length / 1024;
    expect(Number.isInteger(pages)).toBe(true);
    for (let p = 0; p < pages; p++) {
      const calc = crc32c(bytes, p * 1024, p * 1024 + 1020);
      const stored = dv.getUint32(p * 1024 + 1020, false); // big-endian
      expect(stored).toBe(calc);
    }
  });

  it("round-trips points + colour back through the reader", async () => {
    const bytes: Uint8Array = await new E57Exporter().write({sceneModel: pointCloudModel(true)} as any);
    const file = readE57(inRealmArrayBuffer(bytes));
    const pc = file.document.pointClouds[0];
    expect(pc.recordCount).toBe(4);

    const cols = decodeCompressedVector(file.logical, pc, file.header.pageSize);
    const X = cols.get("cartesianX")!, Y = cols.get("cartesianY")!, Z = cols.get("cartesianZ")!;
    // The round-trip is limited by SceneGeometry's 16-bit position quantisation,
    // whose error scales with each axis's extent (here up to 6 → ~1e-3).
    for (let i = 0; i < 4; i++) {
      expect(Math.abs(X[i] - POSITIONS[i * 3])).toBeLessThan(2e-3);
      expect(Math.abs(Y[i] - POSITIONS[i * 3 + 1])).toBeLessThan(2e-3);
      expect(Math.abs(Z[i] - POSITIONS[i * 3 + 2])).toBeLessThan(2e-3);
    }
    const r = cols.get("colorRed")!, gg = cols.get("colorGreen")!, bl = cols.get("colorBlue")!;
    expect(Array.from(r)).toEqual([255, 0, 0, 128]);
    expect(Array.from(gg)).toEqual([0, 255, 0, 128]);
    expect(Array.from(bl)).toEqual([0, 0, 255, 128]);
  });

  it("omits colour fields when the points have none", async () => {
    const bytes: Uint8Array = await new E57Exporter().write({sceneModel: pointCloudModel(false)} as any);
    const pc = readE57(inRealmArrayBuffer(bytes)).document.pointClouds[0];
    expect(pc.prototype.map(f => f.name)).toEqual(["cartesianX", "cartesianY", "cartesianZ"]);
  });

  it("re-imports an exported file through E57Loader", async () => {
    const bytes: Uint8Array = await new E57Exporter().write({sceneModel: pointCloudModel(true)} as any);
    const reloaded = new Scene().createModel({id: "r"}).value!;
    await new E57Loader().load({fileData: inRealmArrayBuffer(bytes), sceneModel: reloaded} as any);
    expect(Object.keys(reloaded.objects)).toHaveLength(1);
    let n = 0;
    for (const id of Object.keys(reloaded.geometries)) n += (reloaded.geometries[id].positionsCompressed.length / 3) | 0;
    expect(n).toBe(4);
  });

  it("round-trips a real scan (bunnyInt24 → export → reload) preserving point count", async () => {
    const b = fs.readFileSync(path.join(__dirname, "fixtures", "bunnyInt24.e57"));
    const loaded = new Scene().createModel({id: "b"}).value!;
    await new E57Loader().load({fileData: inRealmArrayBuffer(b), sceneModel: loaded} as any);

    const bytes: Uint8Array = await new E57Exporter().write({sceneModel: loaded} as any);
    const pc = readE57(inRealmArrayBuffer(bytes)).document.pointClouds[0];
    expect(pc.recordCount).toBe(30571);
  });
});
