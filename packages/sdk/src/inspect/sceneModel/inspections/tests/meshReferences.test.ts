import {TrianglesPrimitive} from "../../../../base/constants";
import {Scene, type SceneModel} from "../../../../model/scene";
import {InspectionRegistry} from "../../InspectionRegistry";
import {inspectSceneModel} from "../../inspectSceneModel";
import {meshReferences} from "../meshReferences";


function meshIssues(sceneModel: SceneModel) {
  const report = inspectSceneModel({
    sceneModel,
    registry: new InspectionRegistry([meshReferences]),
  });
  return report.errors;
}


function model() {
  const sceneModel = new Scene().createModel({id: "m"}).value!;
  expect(sceneModel.createGeometry({
    id: "g",
    primitive: TrianglesPrimitive,
    positions: [0, 0, 0,  1, 0, 0,  0, 1, 0],
    indices: [0, 1, 2],
  }).ok).toBe(true);
  expect(sceneModel.createMaterial({
    id: "mat",
    color: [0.2, 0.4, 0.6],
  }).ok).toBe(true);
  expect(sceneModel.createTransform({id: "t"}).ok).toBe(true);
  expect(sceneModel.createMesh({
    id: "mesh",
    geometryId: "g",
    materialId: "mat",
    parentTransformId: "t",
  }).ok).toBe(true);
  return sceneModel;
}


describe("meshReferences", () => {

  it("reports stale same-id geometry, material, and transform references", () => {
    const sceneModel = model();
    const mesh = sceneModel.meshes["mesh"] as any;
    mesh.geometry = {id: "g", destroyed: false};
    mesh.material = {id: "mat", destroyed: false};
    mesh._parentTransform = {id: "t", destroyed: false};

    const issues = meshIssues(sceneModel);

    expect(issues.map(issue => issue.code).sort()).toEqual([
      "MESH_DANGLING_GEOMETRY",
      "MESH_DANGLING_MATERIAL",
      "MESH_DANGLING_TRANSFORM",
    ]);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({resourceId: "mesh", summary: "→ stale 'g'"}),
      expect.objectContaining({resourceId: "mesh", summary: "→ stale 'mat'"}),
      expect.objectContaining({resourceId: "mesh", summary: "→ stale 't'"}),
    ]));
  });
});
