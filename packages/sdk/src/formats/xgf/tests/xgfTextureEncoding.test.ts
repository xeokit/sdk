import {encode as encodeV4} from "../versions/v1/encode";
import {parse as parseV4} from "../versions/v1/parse";
import {encode as encodeV2} from "../versions/v2/encode";
import {parse as parseV2} from "../versions/v2/parse";
import {
  LinearEncoding,
  LinearFilter,
  LinearMipMapLinearFilter,
  PNGMediaType,
  sRGBEncoding,
  TrianglesPrimitive
} from "../../../base/constants";
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
    textures: {} as Record<string, any>,
    materials: {} as Record<string, any>,
    meshes: {} as Record<string, any>,
    objects: {} as Record<string, any>,
    transforms: {} as Record<string, any>,
    createGeometryCompressed: (p: any) => { sceneModel.geometries[p.id] = p; },
    createMesh: (p: any) => { sceneModel.meshes[p.id] = p; },
    createObject: (p: any) => { sceneModel.objects[p.id] = p; },
    createTexture: (p: any) => { calls.texture.push(p); sceneModel.textures[p.id] = p; },
    createMaterial: (p: any) => { sceneModel.materials[p.id] = p; },
    createTransform: (p: any) => { sceneModel.transforms[p.id] = p; },
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

  it("preserves explicit mipmap opt-in through mipmapped texture minification filters", async () => {
    const src = new Scene().createModel({id: "m"}).value!;
    src.createGeometry({id: "g", primitive: TrianglesPrimitive, ...TRI});
    src.createTexture({
      id: "mipped",
      buffers: [PNG()],
      mediaType: PNGMediaType,
      minFilter: LinearMipMapLinearFilter,
      mipmap: true
    });
    src.createTexture({
      id: "linear",
      buffers: [PNG()],
      mediaType: PNGMediaType,
      minFilter: LinearFilter
    });
    src.createMaterial({id: "mat", colorTextureId: "mipped", emissiveTextureId: "linear"});
    src.createMesh({id: "mesh", geometryId: "g", materialId: "mat"});
    src.createObject({id: "obj", meshIds: ["mesh"]});

    const buffer = await encodeV4({sceneModel: src} as any, {});
    const {sceneModel: dst, calls} = capturingScene();
    await parseV4({fileData: buffer, sceneModel: dst} as any, {});

    expect(calls.texture.find((t: any) => t.id === "mipped").mipmap).toBe(true);
    expect(calls.texture.find((t: any) => t.id === "linear").mipmap).toBe(false);
  });

  it("keeps default texture mipmap opt-in disabled on export round-trip", async () => {
    const src = new Scene().createModel({id: "m"}).value!;
    src.createGeometry({id: "g", primitive: TrianglesPrimitive, ...TRI});
    src.createTexture({id: "default", buffers: [PNG()], mediaType: PNGMediaType});
    src.createMaterial({id: "mat", colorTextureId: "default"});
    src.createMesh({id: "mesh", geometryId: "g", materialId: "mat"});
    src.createObject({id: "obj", meshIds: ["mesh"]});

    const buffer = await encodeV4({sceneModel: src} as any, {});
    const {sceneModel: dst, calls} = capturingScene();
    await parseV4({fileData: buffer, sceneModel: dst} as any, {});

    const texture = calls.texture.find((t: any) => t.id === "default");
    expect(texture.minFilter).toBe(LinearFilter);
    expect(texture.mipmap).toBe(false);
  });
});

describe("xgf v2 — texture sampler state", () => {

  it("preserves explicit mipmap opt-in through mipmapped texture minification filters", async () => {
    const src = new Scene().createModel({id: "m"}).value!;
    src.createGeometry({id: "g", primitive: TrianglesPrimitive, ...TRI});
    src.createTexture({
      id: "mipped",
      buffers: [PNG()],
      mediaType: PNGMediaType,
      minFilter: LinearMipMapLinearFilter,
      mipmap: true
    });
    src.createTexture({
      id: "linear",
      buffers: [PNG()],
      mediaType: PNGMediaType,
      minFilter: LinearFilter
    });
    src.createMaterial({id: "mat", colorTextureId: "mipped", emissiveTextureId: "linear"});
    src.createMesh({id: "mesh", geometryId: "g", materialId: "mat"});
    src.createObject({id: "obj", meshIds: ["mesh"]});

    const buffer = await encodeV2({sceneModel: src} as any, {});
    const {sceneModel: dst, calls} = capturingScene();
    await parseV2({fileData: buffer, sceneModel: dst} as any, {});

    expect(calls.texture.find((t: any) => t.id === "mipped").mipmap).toBe(true);
    expect(calls.texture.find((t: any) => t.id === "linear").mipmap).toBe(false);
  });

  it("keeps default texture mipmap opt-in disabled on export round-trip", async () => {
    const src = new Scene().createModel({id: "m"}).value!;
    src.createGeometry({id: "g", primitive: TrianglesPrimitive, ...TRI});
    src.createTexture({id: "default", buffers: [PNG()], mediaType: PNGMediaType});
    src.createMaterial({id: "mat", colorTextureId: "default"});
    src.createMesh({id: "mesh", geometryId: "g", materialId: "mat"});
    src.createObject({id: "obj", meshIds: ["mesh"]});

    const buffer = await encodeV2({sceneModel: src} as any, {});
    const {sceneModel: dst, calls} = capturingScene();
    await parseV2({fileData: buffer, sceneModel: dst} as any, {});

    const texture = calls.texture.find((t: any) => t.id === "default");
    expect(texture.minFilter).toBe(LinearFilter);
    expect(texture.mipmap).toBe(false);
  });
});
