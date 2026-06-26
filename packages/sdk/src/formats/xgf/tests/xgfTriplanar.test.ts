import {encode as encodeV4} from "../versions/v1/encode";
import {parse as parseV4} from "../versions/v1/parse";
import {TrianglesPrimitive} from "../../../base/constants";
import {Scene} from "../../../model/scene/Scene";
import {XGFExporter} from "../XGFExporter";

// Capturing destination — records the params handed to createMaterial so we can
// assert the round-tripped triplanarScale.
function capturingScene() {
  const calls: {material: any[]} = {material: []};
  const sceneModel: any = {
    id: "dst",
    geometries: {} as Record<string, any>,
    createGeometryCompressed: (p: any) => { sceneModel.geometries[p.id] = p; },
    createMesh: () => {},
    createObject: () => {},
    createTexture: () => {},
    createMaterial: (p: any) => calls.material.push(p),
  };
  return {sceneModel, calls};
}

const TRI = {positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2]};

function versionWord(buffer: any): number {
  const ab = buffer.buffer ?? buffer;
  return new DataView(ab, buffer.byteOffset ?? 0).getUint32(0, true);
}

describe("xgf v1 — triplanar", () => {

  it("round-trips per-material triplanarScale", async () => {
    const src = new Scene().createModel({id: "m"}).value!;
    src.createGeometry({id: "g", primitive: TrianglesPrimitive, ...TRI});
    src.createMaterial({id: "mat", color: [1, 1, 1], triplanarScale: 2.5});
    src.createMesh({id: "mesh", geometryId: "g", materialId: "mat"});
    src.createObject({id: "obj", meshIds: ["mesh"]});

    const buffer = await encodeV4({sceneModel: src} as any, {});
    expect(versionWord(buffer)).toBe(1);

    const {sceneModel: dst, calls} = capturingScene();
    await parseV4({fileData: buffer, sceneModel: dst} as any, {});

    const mat = calls.material.find((m: any) => m.id === "mat");
    expect(mat).toBeDefined();
    expect(mat.triplanarScale).toBeCloseTo(2.5, 4);
  });

  it("keeps the default triplanarScale (1.0) when unspecified", async () => {
    const src = new Scene().createModel({id: "m"}).value!;
    src.createGeometry({id: "g", primitive: TrianglesPrimitive, ...TRI});
    src.createMaterial({id: "mat", color: [0.5, 0.5, 0.5]});
    src.createMesh({id: "mesh", geometryId: "g", materialId: "mat"});
    src.createObject({id: "obj", meshIds: ["mesh"]});

    const buffer = await encodeV4({sceneModel: src} as any, {});
    const {sceneModel: dst, calls} = capturingScene();
    await parseV4({fileData: buffer, sceneModel: dst} as any, {});

    expect(calls.material.find((m: any) => m.id === "mat").triplanarScale).toBeCloseTo(1.0, 4);
  });

  it("XGFExporter writes version 1 for a textured model (approach B)", async () => {
    const src = new Scene().createModel({id: "m"}).value!;
    src.createGeometry({id: "g", primitive: TrianglesPrimitive, ...TRI});
    // A textured model writes the single XGF version 1.
    src.createTexture({id: "tex", buffers: [new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer], mediaType: 10002});
    src.createMaterial({id: "mat", color: [1, 1, 1], colorTextureId: "tex", triplanarScale: 3});
    src.createMesh({id: "mesh", geometryId: "g", materialId: "mat"});
    src.createObject({id: "obj", meshIds: ["mesh"]});

    const buffer = await new XGFExporter().write({sceneModel: src} as any);
    expect(versionWord(buffer)).toBe(1);
  });
});
