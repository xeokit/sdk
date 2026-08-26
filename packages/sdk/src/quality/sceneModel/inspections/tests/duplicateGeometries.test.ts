import {GaussianSplatsPrimitive, TrianglesPrimitive} from "../../../../base/constants";
import {Scene, type SceneModel} from "../../../../model/scene";
import {InspectionRegistry} from "../../InspectionRegistry";
import {inspectSceneModel} from "../../qualitySceneModel";
import {duplicateGeometries} from "../duplicateGeometries";


const POSITIONS = [0, 0, 0,  1, 0, 0,  0, 1, 0];
const INDICES = [0, 1, 2];


function duplicateIssues(sceneModel: SceneModel) {
  const report = inspectSceneModel({
    sceneModel,
    registry: new InspectionRegistry([duplicateGeometries]),
    checkDuplicateGeometries: true,
  });
  return report.byCode.get("GEOMETRY_DUPLICATE") ?? [];
}


describe("duplicateGeometries", () => {

  it("reports geometries whose full payload matches", () => {
    const m = new Scene().createModel({id: "m"}).value!;
    for (const id of ["a", "b"]) {
      m.createGeometry({
        id,
        primitive: TrianglesPrimitive,
        positions: POSITIONS,
        indices: INDICES,
        colors: [1, 0, 0, 1,  0, 1, 0, 1,  0, 0, 1, 1],
      });
    }

    const issues = duplicateIssues(m);

    expect(issues).toHaveLength(1);
    expect(issues[0].resourceId).toBe("a");
    expect(issues[0].context).toEqual({duplicates: ["b"]});
  });

  it("does not merge geometries that only differ by vertex color", () => {
    const m = new Scene().createModel({id: "m"}).value!;
    m.createGeometry({
      id: "red",
      primitive: TrianglesPrimitive,
      positions: POSITIONS,
      indices: INDICES,
      colors: [1, 0, 0, 1,  1, 0, 0, 1,  1, 0, 0, 1],
    });
    m.createGeometry({
      id: "green",
      primitive: TrianglesPrimitive,
      positions: POSITIONS,
      indices: INDICES,
      colors: [0, 1, 0, 1,  0, 1, 0, 1,  0, 1, 0, 1],
    });

    expect(duplicateIssues(m)).toHaveLength(0);
  });

  it("does not merge geometries that only differ by edge indices", () => {
    const m = new Scene().createModel({id: "m"}).value!;
    m.createGeometryCompressed({
      id: "edge-a",
      primitive: TrianglesPrimitive,
      positionsCompressed: [0, 0, 0,  65535, 0, 0,  0, 65535, 0],
      aabb: [0, 0, 0, 1, 1, 0],
      indices: INDICES,
      edgeIndices: [0, 1],
    });
    m.createGeometryCompressed({
      id: "edge-b",
      primitive: TrianglesPrimitive,
      positionsCompressed: [0, 0, 0,  65535, 0, 0,  0, 65535, 0],
      aabb: [0, 0, 0, 1, 1, 0],
      indices: INDICES,
      edgeIndices: [1, 2],
    });

    expect(duplicateIssues(m)).toHaveLength(0);
  });

  it("does not merge gaussian splats that only differ by scale", () => {
    const m = new Scene().createModel({id: "m"}).value!;
    m.createGeometryCompressed({
      id: "splat-a",
      primitive: GaussianSplatsPrimitive,
      positionsCompressed: [0, 0, 0],
      aabb: [0, 0, 0, 0, 0, 0],
      scales: [1, 1, 1],
      rotations: [0, 0, 0, 1],
    });
    m.createGeometryCompressed({
      id: "splat-b",
      primitive: GaussianSplatsPrimitive,
      positionsCompressed: [0, 0, 0],
      aabb: [0, 0, 0, 0, 0, 0],
      scales: [2, 1, 1],
      rotations: [0, 0, 0, 1],
    });

    expect(duplicateIssues(m)).toHaveLength(0);
  });
});
