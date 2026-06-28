import {Scene} from "../../model/scene";
import {TrianglesPrimitive} from "../../base/constants";
import {findTriplanarTextureSkip} from "../findTriplanarTextureSkip";
import {GLTFExporter} from "../gltf/GLTFExporter";

const TRI = {positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2]};
const PNG = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]).buffer;

// Textured material on UV-less geometry → the renderer samples it via triplanar.
function triplanarModel() {
  const sm = new Scene().createModel({id: "m"}).value!;
  sm.createGeometry({id: "g", primitive: TrianglesPrimitive, ...TRI}); // no uvs
  sm.createTexture({id: "tex", buffers: [PNG()], mediaType: 10002});
  sm.createMaterial({id: "mat", color: [1, 1, 1], colorTextureId: "tex"});
  sm.createMesh({id: "mesh", geometryId: "g", materialId: "mat"});
  sm.createObject({id: "obj", meshIds: ["mesh"]});
  return sm;
}

describe("triplanar texture skip", () => {

  it("flags textured materials used only on UV-less geometry", () => {
    const skip = findTriplanarTextureSkip(triplanarModel());
    expect(skip.materialIds.has("mat")).toBe(true);
    expect(skip.textureIds.has("tex")).toBe(true);
    expect(skip.any).toBe(true);
  });

  it("does NOT flag a textured material used on UV geometry", () => {
    const sm = new Scene().createModel({id: "m"}).value!;
    sm.createGeometry({id: "g", primitive: TrianglesPrimitive, ...TRI, uvs: [0, 0, 1, 0, 0, 1]});
    sm.createTexture({id: "tex", buffers: [PNG()], mediaType: 10002});
    sm.createMaterial({id: "mat", color: [1, 1, 1], colorTextureId: "tex"});
    sm.createMesh({id: "mesh", geometryId: "g", materialId: "mat"});
    sm.createObject({id: "obj", meshIds: ["mesh"]});
    expect(findTriplanarTextureSkip(sm).any).toBe(false);
  });

  it("keeps a texture that is also used by a UV material", () => {
    const sm = new Scene().createModel({id: "m"}).value!;
    sm.createGeometry({id: "gNoUV", primitive: TrianglesPrimitive, ...TRI});
    sm.createGeometry({id: "gUV", primitive: TrianglesPrimitive, ...TRI, uvs: [0, 0, 1, 0, 0, 1]});
    sm.createTexture({id: "tex", buffers: [PNG()], mediaType: 10002});
    sm.createMaterial({id: "triplanarMat", color: [1, 1, 1], colorTextureId: "tex"});
    sm.createMaterial({id: "uvMat", color: [1, 1, 1], colorTextureId: "tex"});
    sm.createMesh({id: "m1", geometryId: "gNoUV", materialId: "triplanarMat"});
    sm.createMesh({id: "m2", geometryId: "gUV", materialId: "uvMat"});
    sm.createObject({id: "obj", meshIds: ["m1", "m2"]});
    const skip = findTriplanarTextureSkip(sm);
    expect(skip.materialIds.has("triplanarMat")).toBe(true); // flat in output
    expect(skip.textureIds.has("tex")).toBe(false);          // still needed by uvMat
  });

  it("GLTFExporter drops the triplanar texture and flattens the material", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const glb: Uint8Array = await new GLTFExporter().write({sceneModel: triplanarModel()} as any);

    const dv = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
    const jsonLen = dv.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLen)));

    expect(json.textures ?? []).toHaveLength(0);
    expect(json.images ?? []).toHaveLength(0);
    expect(json.materials[0].pbrMetallicRoughness?.baseColorTexture).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/triplanar/i));
    warn.mockRestore();
  });
});
