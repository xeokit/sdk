import {LinesPrimitive} from "../../../../base/constants";
import {Scene, type SceneModel} from "../../../../model/scene";
import {InspectionRegistry} from "../../InspectionRegistry";
import {inspectSceneModel} from "../../qualitySceneModel";
import {denseGeometries} from "../denseGeometries";


function denseIssues(
  sceneModel: SceneModel,
  overrides: Partial<Parameters<typeof inspectSceneModel>[0]>,
) {
  const report = inspectSceneModel({
    sceneModel,
    registry: new InspectionRegistry([denseGeometries]),
    checkDenseGeometries: true,
    ...overrides,
  });
  return report.byCode.get("GEOMETRY_OVER_BUDGET") ?? [];
}


describe("denseGeometries", () => {

  it("counts line index pairs as line primitives", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    expect(sceneModel.createGeometry({
      id: "lines",
      primitive: LinesPrimitive,
      positions: [
        0, 0, 0,
        1, 0, 0,
        2, 0, 0,
        3, 0, 0,
        4, 0, 0,
        5, 0, 0,
      ],
      indices: [
        0, 1,
        2, 3,
        4, 5,
        0, 2,
      ],
    }).ok).toBe(true);

    const issues = denseIssues(sceneModel, {maxVertices: 100, maxPrimitives: 3});

    expect(issues).toHaveLength(1);
    expect(issues[0].resourceId).toBe("lines");
    expect(issues[0].summary).toBe("6 verts · 4 prims");
    expect(issues[0].context).toMatchObject({
      maxPrimitives: 3,
      primitiveCount: 4,
    });
    expect(issues[0].message).toContain("4 primitives > 3");
  });
});
