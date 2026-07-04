import {TrianglesPrimitive} from "../../../../base/constants";
import {Scene, type SceneModel} from "../../../../model/scene";
import {InspectionRegistry} from "../../InspectionRegistry";
import {inspectSceneModel} from "../../inspectSceneModel";
import {unusedResources} from "../unusedResources";


function unusedIds(sceneModel: SceneModel, code: string) {
  const report = inspectSceneModel({
    sceneModel,
    registry: new InspectionRegistry([unusedResources]),
  });
  return (report.byCode.get(code) ?? []).map(issue => issue.resourceId);
}


function transformUnusedIds(sceneModel: SceneModel) {
  return unusedIds(sceneModel, "TRANSFORM_UNUSED");
}


function materialUnusedIds(sceneModel: SceneModel) {
  return unusedIds(sceneModel, "MATERIAL_UNUSED");
}


function textureUnusedIds(sceneModel: SceneModel) {
  return unusedIds(sceneModel, "TEXTURE_UNUSED");
}


function createTriangleGeometry(sceneModel: SceneModel) {
  expect(sceneModel.createGeometry({
    id: "g",
    primitive: TrianglesPrimitive,
    positions: [0, 0, 0,  1, 0, 0,  0, 1, 0],
    indices: [0, 1, 2],
  }).ok).toBe(true);
}


describe("unusedResources", () => {

  it("does not treat stale same-id mesh parent refs as live transform usage", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    expect(sceneModel.createTransform({id: "t"}).ok).toBe(true);
    createTriangleGeometry(sceneModel);
    expect(sceneModel.createMesh({
      id: "mesh",
      geometryId: "g",
    }).ok).toBe(true);
    (sceneModel.meshes["mesh"] as any)._parentTransform = {id: "t", destroyed: false};

    expect(transformUnusedIds(sceneModel)).toContain("t");
  });

  it("does not treat stale same-id transform parent refs as live transform ancestors", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    expect(sceneModel.createTransform({id: "parent"}).ok).toBe(true);
    expect(sceneModel.createTransform({id: "child", parentTransformId: "parent"}).ok).toBe(true);
    createTriangleGeometry(sceneModel);
    expect(sceneModel.createMesh({
      id: "mesh",
      geometryId: "g",
      parentTransformId: "child",
    }).ok).toBe(true);
    (sceneModel.transforms["child"] as any)._parentTransform = {id: "parent", destroyed: false};

    expect(transformUnusedIds(sceneModel)).toContain("parent");
    expect(transformUnusedIds(sceneModel)).not.toContain("child");
  });

  it("does not treat stale same-id mesh material refs as live material usage", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    createTriangleGeometry(sceneModel);
    expect(sceneModel.createMaterial({id: "mat"}).ok).toBe(true);
    expect(sceneModel.createMesh({
      id: "mesh",
      geometryId: "g",
      materialId: "mat",
    }).ok).toBe(true);
    (sceneModel.meshes["mesh"] as any).material = {id: "mat", destroyed: false};

    expect(materialUnusedIds(sceneModel)).toContain("mat");
  });

  it("does not treat stale same-id material texture refs as live texture usage", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    expect(sceneModel.createTexture({id: "tex", src: "texture.png"}).ok).toBe(true);
    expect(sceneModel.createMaterial({
      id: "mat",
      colorTextureId: "tex",
    }).ok).toBe(true);
    (sceneModel.materials["mat"] as any).colorTexture = {id: "tex", destroyed: false};

    expect(textureUnusedIds(sceneModel)).toContain("tex");
  });
});
