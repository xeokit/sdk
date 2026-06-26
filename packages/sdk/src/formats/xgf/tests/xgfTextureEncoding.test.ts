import {encode as encodeV4} from "../versions/v1/encode";
import {parse as parseV4} from "../versions/v1/parse";
import {TrianglesPrimitive, PNGMediaType, sRGBEncoding, LinearEncoding} from "../../../base/constants";
import {Scene} from "../../../model/scene/Scene";

const TRI = {positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2]};
const PNG = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]).buffer;

// Capturing destination that records the params handed to createTexture, so we
// can assert the round-tripped per-texture encoding.
function capturingScene() {
  const calls: {texture: any[]} = {texture: []};
  const sceneModel: any = {
    id: "dst",
    geometries: {} as Record<string, any>,
    createGeometryCompressed: (p: any) => { sceneModel.geometries[p.id] = p; },
    createMesh: () => {},
    createObject: () => {},
    createTexture: (p: any) => calls.texture.push(p),
    createMaterial: () => {},
  };
  return {sceneModel, calls};
}

describe("xgf v1 — texture encoding", () => {

  it("round-trips per-texture colour-space encoding (sRGB stays sRGB)", async () => {
    const src = new Scene().createModel({id: "m"}).value!;
    src.createGeometry({id: "g", primitive: TrianglesPrimitive, ...TRI});
    src.createTexture({id: "albedo", buffers: [PNG()], mediaType: PNGMediaType, encoding: sRGBEncoding});
    src.createTexture({id: "normal", buffers: [PNG()], mediaType: PNGMediaType, encoding: LinearEncoding});
    src.createMaterial({id: "mat", color: [1, 1, 1], colorTextureId: "albedo", normalsTextureId: "normal"});
    src.createMesh({id: "mesh", geometryId: "g", materialId: "mat"});
    src.createObject({id: "obj", meshIds: ["mesh"]});

    const buffer = await encodeV4({sceneModel: src} as any, {});
    const {sceneModel: dst, calls} = capturingScene();
    await parseV4({fileData: buffer, sceneModel: dst} as any, {});

    const albedo = calls.texture.find((t: any) => t.id === "albedo");
    const normal = calls.texture.find((t: any) => t.id === "normal");
    expect(albedo.encoding).toBe(sRGBEncoding);
    expect(normal.encoding).toBe(LinearEncoding);
  });
});
