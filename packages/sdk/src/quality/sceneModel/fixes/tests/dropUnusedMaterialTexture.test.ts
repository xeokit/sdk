import {TrianglesPrimitive} from "../../../../base/constants";
import {Scene, type SceneModel} from "../../../../model/scene";
import {dropUnusedMaterial} from "../dropUnusedMaterial";
import {dropUnusedTexture} from "../dropUnusedTexture";


function createTriangleGeometry(sceneModel: SceneModel) {
  expect(sceneModel.createGeometry({
    id: "g",
    primitive: TrianglesPrimitive,
    positions: [0, 0, 0,  1, 0, 0,  0, 1, 0],
    indices: [0, 1, 2],
  }).ok).toBe(true);
}


describe("dropUnusedMaterial/dropUnusedTexture", () => {

  it("ignores stale same-id mesh material refs when dropping unused materials", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    createTriangleGeometry(sceneModel);
    expect(sceneModel.createMaterial({id: "mat"}).ok).toBe(true);
    expect(sceneModel.createMesh({
      id: "mesh",
      geometryId: "g",
      materialId: "mat",
    }).ok).toBe(true);
    (sceneModel.meshes["mesh"] as any).material = {id: "mat", destroyed: false};

    const res = dropUnusedMaterial.apply({resourceId: "mat"} as any, sceneModel);

    expect(res.ok).toBe(true);
    expect((res as any).value.fixed).toBe(true);
    expect(sceneModel.materials["mat"]).toBeUndefined();
  });

  it("ignores stale same-id material texture refs when dropping unused textures", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    expect(sceneModel.createTexture({id: "tex", src: "texture.png"}).ok).toBe(true);
    expect(sceneModel.createMaterial({
      id: "mat",
      colorTextureId: "tex",
    }).ok).toBe(true);
    (sceneModel.materials["mat"] as any).colorTexture = {id: "tex", destroyed: false};

    const res = dropUnusedTexture.apply({resourceId: "tex"} as any, sceneModel);

    expect(res.ok).toBe(true);
    expect((res as any).value.fixed).toBe(true);
    expect(sceneModel.textures["tex"]).toBeUndefined();
  });
});
