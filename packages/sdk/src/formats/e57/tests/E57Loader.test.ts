import * as fs from "fs";
import * as path from "path";
import {Scene} from "../../../model/scene";
import {PointsPrimitive} from "../../../base/constants";
import {E57Loader} from "../E57Loader";
import {installE57TestGlobals} from "./installE57TestGlobals";

let restoreGlobals: (() => void) | null = null;

beforeAll(async () => {
  restoreGlobals = await installE57TestGlobals();
});

afterAll(() => {
  restoreGlobals?.();
});

function fixture(name: string): ArrayBuffer {
  const b = fs.readFileSync(path.join(__dirname, "fixtures", name));
  // Copy into an ArrayBuffer created in THIS realm — under jsdom, fs's buffer
  // comes from the Node realm and would fail the loader's `instanceof
  // ArrayBuffer` guard.
  const ab = new ArrayBuffer(b.byteLength);
  new Uint8Array(ab).set(b);
  return ab;
}

function pointCount(model: any): number {
  let n = 0;
  for (const id of Object.keys(model.geometries)) n += (model.geometries[id].positionsCompressed.length / 3) | 0;
  return n;
}

describe("E57Loader", () => {

  it("loads a scan into one SceneObject with all its points as point geometry", async () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    await new E57Loader().load({fileData: fixture("tinyCartesianFloatRgb.e57"), sceneModel} as any);

    // One scan → one SceneObject.
    expect(Object.keys(sceneModel.objects)).toHaveLength(1);
    // Every point kept (no decimation).
    expect(pointCount(sceneModel)).toBe(2090);
    // Geometries are points and carry per-point colour.
    const geoms = Object.values(sceneModel.geometries) as any[];
    expect(geoms.length).toBeGreaterThan(0);
    expect(geoms[0].primitive).toBe(PointsPrimitive);
    expect(geoms[0].colorsCompressed && geoms[0].colorsCompressed.length).toBeGreaterThan(0);
  });

  it("places points in a per-scan RTC frame (geometry AABB is local, not absolute)", async () => {
    // This scan's absolute Z is ~297; with the RTC origin subtracted the local
    // geometry bounds must be small and centred near zero.
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    await new E57Loader().load({fileData: fixture("tinyCartesianFloatRgb.e57"), sceneModel} as any);
    for (const id of Object.keys(sceneModel.geometries)) {
      const aabb = sceneModel.geometries[id].aabb as number[];
      for (let k = 0; k < 3; k++) {
        expect(Math.abs(aabb[k])).toBeLessThan(10);     // min
        expect(Math.abs(aabb[k + 3])).toBeLessThan(10); // max
      }
    }
  });

  it("decimates with `skip`", async () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    await new E57Loader().load({fileData: fixture("tinyCartesianFloatRgb.e57"), sceneModel} as any, {skip: 10});
    // ceil(2090 / 10) = 209 kept.
    expect(pointCount(sceneModel)).toBe(209);
  });

  it("decodes a scaled-integer scan (bunnyInt24) into geometry", async () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    await new E57Loader().load({fileData: fixture("bunnyInt24.e57"), sceneModel} as any);
    expect(Object.keys(sceneModel.objects)).toHaveLength(1);
    expect(pointCount(sceneModel)).toBe(30571);
  });
});
