import {TrianglesPrimitive} from "../../../../base/constants";
import {Scene, type SceneModel} from "../../../../model/scene";
import {InspectionRegistry} from "../../InspectionRegistry";
import {inspectSceneModel} from "../../qualitySceneModel";
import {objectMeshReferences} from "../objectMeshReferences";


function objectMeshIssues(sceneModel: SceneModel) {
  const report = inspectSceneModel({
    sceneModel,
    registry: new InspectionRegistry([objectMeshReferences]),
  });
  return report.byCode.get("OBJECT_DANGLING_MESH") ?? [];
}


describe("objectMeshReferences", () => {

  it("reports mesh entries that no longer point back to the object", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
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
    expect(sceneModel.createObject({
      id: "object",
      meshIds: ["mesh"],
    }).ok).toBe(true);
    sceneModel.meshes["mesh"].object = null;

    const issues = objectMeshIssues(sceneModel);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: "OBJECT_DANGLING_MESH",
      resourceId: "object",
      context: {danglingMeshId: "mesh"},
      summary: "stale 'mesh'",
    });
  });
});
