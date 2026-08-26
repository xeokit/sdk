import {TrianglesPrimitive} from "../../../../base/constants";
import {Scene, type SceneModel} from "../../../../model/scene";
import {InspectionRegistry} from "../../InspectionRegistry";
import {inspectSceneModel} from "../../qualitySceneModel";
import {geometryArrayLengths} from "../geometryArrayLengths";


function oversizedIssues(
  sceneModel: SceneModel,
  overrides: Partial<Parameters<typeof inspectSceneModel>[0]>,
) {
  const report = inspectSceneModel({
    sceneModel,
    registry: new InspectionRegistry([geometryArrayLengths]),
    checkGeometryArrayLengths: true,
    ...overrides,
  });
  return report.byCode.get("GEOMETRY_ARRAY_OVERSIZED") ?? [];
}


describe("geometryArrayLengths", () => {

  it("reports colorsCompressed buffers over the configured array threshold", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    expect(sceneModel.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [0, 0, 0,  1, 0, 0,  0, 1, 0],
      indices: [0, 1, 2],
      colors: [1, 0, 0, 1,  0, 1, 0, 1,  0, 0, 1, 1],
    }).ok).toBe(true);

    const issues = oversizedIssues(sceneModel, {maxColorsLength: 8});

    expect(issues).toHaveLength(1);
    expect(issues[0].resourceId).toBe("g");
    expect(issues[0].summary).toBe("12 col");
    expect(issues[0].context).toMatchObject({
      maxColorsLength: 8,
      colorsLength: 12,
    });
    expect(issues[0].message).toContain("colors 12 > 8");
  });

  it("accepts colorsCompressed buffers at the configured array threshold", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    expect(sceneModel.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [0, 0, 0,  1, 0, 0,  0, 1, 0],
      indices: [0, 1, 2],
      colors: [1, 0, 0, 1,  0, 1, 0, 1,  0, 0, 1, 1],
    }).ok).toBe(true);

    expect(oversizedIssues(sceneModel, {maxColorsLength: 12})).toHaveLength(0);
  });

  it("reports edgeIndices buffers over the configured array threshold", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    expect(sceneModel.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [0, 0, 0,  1, 0, 0,  0, 1, 0],
      indices: [0, 1, 2],
    }).ok).toBe(true);
    (sceneModel.geometries["g"] as any).edgeIndices = new Uint16Array([0, 1, 1, 2, 2, 0]);

    const issues = oversizedIssues(sceneModel, {maxEdgeIndicesLength: 4});

    expect(issues).toHaveLength(1);
    expect(issues[0].resourceId).toBe("g");
    expect(issues[0].summary).toBe("6 edge");
    expect(issues[0].context).toMatchObject({
      maxEdgeIndicesLength: 4,
      edgeIndicesLength: 6,
    });
    expect(issues[0].message).toContain("edgeIndices 6 > 4");
  });
});
