import {GaussianSplatsPrimitive, TrianglesPrimitive} from "../../../../base/constants";
import {Scene, type SceneModel} from "../../../../model/scene";
import {InspectionRegistry} from "../../InspectionRegistry";
import {inspectSceneModel} from "../../qualitySceneModel";
import {geometryDataIntegrity} from "../geometryDataIntegrity";


function integrityCodes(sceneModel: SceneModel) {
  const report = inspectSceneModel({
    sceneModel,
    registry: new InspectionRegistry([geometryDataIntegrity]),
  });
  return report.errors.map(issue => issue.code);
}


describe("geometryDataIntegrity", () => {

  it("accepts colorsCompressed with one RGBA tuple per vertex", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    expect(sceneModel.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [0, 0, 0,  1, 0, 0,  0, 1, 0],
      indices: [0, 1, 2],
      colors: [1, 0, 0, 1,  0, 1, 0, 1,  0, 0, 1, 1],
    }).ok).toBe(true);

    expect(integrityCodes(sceneModel)).not.toContain("GEOMETRY_COLORS_LENGTH");
  });

  it("reports colorsCompressed whose length is not four times vertex count", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    expect(sceneModel.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [0, 0, 0,  1, 0, 0,  0, 1, 0],
      indices: [0, 1, 2],
      colors: [1, 0, 0, 1,  0, 1, 0, 1,  0, 0, 1, 1],
    }).ok).toBe(true);
    (sceneModel.geometries["g"] as any).colorsCompressed = new Uint8Array([255, 0, 0, 255]);

    expect(integrityCodes(sceneModel)).toContain("GEOMETRY_COLORS_LENGTH");
  });

  it("reports AABBs that do not have six values", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    expect(sceneModel.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [0, 0, 0,  1, 0, 0,  0, 1, 0],
      indices: [0, 1, 2],
    }).ok).toBe(true);
    (sceneModel.geometries["g"] as any).aabb = new Float32Array([0, 0, 0, 1, 1]);

    expect(integrityCodes(sceneModel)).toContain("GEOMETRY_AABB_LENGTH");
  });

  it("reports unsupported primitive constants", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    expect(sceneModel.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [0, 0, 0,  1, 0, 0,  0, 1, 0],
      indices: [0, 1, 2],
    }).ok).toBe(true);
    (sceneModel.geometries["g"] as any).primitive = 12345;

    expect(integrityCodes(sceneModel)).toContain("GEOMETRY_PRIMITIVE_UNSUPPORTED");
  });

  it("reports indexed primitives without a non-empty indices buffer", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    expect(sceneModel.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [0, 0, 0,  1, 0, 0,  0, 1, 0],
      indices: [0, 1, 2],
    }).ok).toBe(true);
    (sceneModel.geometries["g"] as any).indices = new Uint16Array(0);

    expect(integrityCodes(sceneModel)).toContain("GEOMETRY_NO_INDICES");
  });

  it("reports negative indices as out of range", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    expect(sceneModel.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [0, 0, 0,  1, 0, 0,  0, 1, 0],
      indices: [0, 1, 2],
    }).ok).toBe(true);
    (sceneModel.geometries["g"] as any).indices = [0, -1, 2];

    expect(integrityCodes(sceneModel)).toContain("GEOMETRY_INDEX_OUT_OF_RANGE");
  });

  it("reports edgeIndices whose length is not a pair count", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    expect(sceneModel.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [0, 0, 0,  1, 0, 0,  0, 1, 0],
      indices: [0, 1, 2],
    }).ok).toBe(true);
    (sceneModel.geometries["g"] as any).edgeIndices = new Uint16Array([0, 1, 2]);

    expect(integrityCodes(sceneModel)).toContain("GEOMETRY_EDGE_INDICES_LENGTH");
  });

  it("reports edgeIndices that reference missing vertices", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    expect(sceneModel.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [0, 0, 0,  1, 0, 0,  0, 1, 0],
      indices: [0, 1, 2],
    }).ok).toBe(true);
    (sceneModel.geometries["g"] as any).edgeIndices = [0, -1];

    expect(integrityCodes(sceneModel)).toContain("GEOMETRY_EDGE_INDEX_OUT_OF_RANGE");
  });

  it("reports gaussian splats with missing scale or rotation tuples", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    expect(sceneModel.createGeometry({
      id: "splats",
      primitive: GaussianSplatsPrimitive,
      positions: [0, 0, 0,  1, 2, 3],
      scales: [0.1, 0.2, 0.3,  1, 1, 1],
      rotations: [0, 0, 0, 1,  0, 0, 0, 1],
      colorsCompressed: [255, 0, 0, 255,  0, 255, 0, 128],
    }).ok).toBe(true);
    (sceneModel.geometries["splats"] as any).scales = [0.1, 0.2, 0.3];
    (sceneModel.geometries["splats"] as any).rotations = undefined;

    const codes = integrityCodes(sceneModel);
    expect(codes).toContain("GEOMETRY_SPLAT_SCALES_LENGTH");
    expect(codes).toContain("GEOMETRY_SPLAT_ROTATIONS_LENGTH");
  });
});
