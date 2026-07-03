import {TrianglesPrimitive} from "../../../../base/constants";
import {Scene, type SceneModel} from "../../../../model/scene";
import {InspectionRegistry} from "../../InspectionRegistry";
import {inspectSceneModel} from "../../inspectSceneModel";
import {geometryQuality} from "../geometryQuality";


function qualityCodes(sceneModel: SceneModel) {
  const report = inspectSceneModel({
    sceneModel,
    registry: new InspectionRegistry([geometryQuality]),
    checkGeometryQuality: true,
  });
  return report.warnings.map(issue => issue.code);
}


describe("geometryQuality", () => {

  it("does not report loose AABB for collapsed axes that are already tight", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    expect(sceneModel.createGeometryCompressed({
      id: "plane",
      primitive: TrianglesPrimitive,
      positionsCompressed: [0, 0, 0,  65535, 0, 0,  0, 65535, 0],
      aabb: [0, 0, 0,  1, 1, 0],
      indices: [0, 1, 2],
    }).ok).toBe(true);

    const codes = qualityCodes(sceneModel);

    expect(codes).toContain("GEOMETRY_ZERO_VOLUME_AABB");
    expect(codes).not.toContain("GEOMETRY_AABB_NOT_TIGHT");
  });
});
