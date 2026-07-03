import {TrianglesPrimitive} from "../../../../base/constants";
import {Scene, type SceneModel} from "../../../../model/scene";
import {InspectionRegistry} from "../../InspectionRegistry";
import {inspectSceneModel} from "../../inspectSceneModel";
import {unusedResources} from "../unusedResources";


function transformUnusedIds(sceneModel: SceneModel) {
  const report = inspectSceneModel({
    sceneModel,
    registry: new InspectionRegistry([unusedResources]),
  });
  return (report.byCode.get("TRANSFORM_UNUSED") ?? []).map(issue => issue.resourceId);
}


describe("unusedResources", () => {

  it("does not treat stale same-id mesh parent refs as live transform usage", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    expect(sceneModel.createTransform({id: "t"}).ok).toBe(true);
    expect(sceneModel.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [0, 0, 0,  1, 0, 0,  0, 1, 0],
      indices: [0, 1, 2],
    }).ok).toBe(true);
    expect(sceneModel.createMesh({
      id: "mesh",
      geometryId: "g",
    }).ok).toBe(true);
    (sceneModel.meshes["mesh"] as any)._parentTransform = {id: "t", destroyed: false};

    expect(transformUnusedIds(sceneModel)).toContain("t");
  });
});
