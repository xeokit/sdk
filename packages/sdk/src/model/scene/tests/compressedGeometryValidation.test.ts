import {Scene} from "../Scene";
import {
  GaussianSplatsPrimitive,
  TrianglesPrimitive,
} from "../../../base/constants";


const TRIANGLE_POSITIONS = [0, 0, 0, 65535, 0, 0, 0, 65535, 0];
const TRIANGLE_AABB = [0, 0, 0, 1, 1, 0];

function model() {
  return new Scene().createModel({id: "m"}).value!;
}

function triangleParams(overrides: Record<string, unknown> = {}) {
  return {
    id: "g",
    primitive: TrianglesPrimitive,
    positionsCompressed: TRIANGLE_POSITIONS,
    aabb: TRIANGLE_AABB,
    indices: [0, 1, 2],
    ...overrides,
  };
}

describe("SceneModel.createGeometryCompressed validation", () => {

  it("accepts valid compressed triangle geometry", () => {
    const sceneModel = model();

    const result = sceneModel.createGeometryCompressed(triangleParams());

    expect(result.ok).toBe(true);
    expect(sceneModel.geometries["g"]).toBe(result.value);
    expect(sceneModel.stats.numGeometries).toBe(1);
    expect(sceneModel.stats.numVertices).toBe(3);
    expect(sceneModel.stats.numTriangles).toBe(1);
  });

  it.each([
    ["empty positionsCompressed", triangleParams({positionsCompressed: []})],
    ["non-triplet positionsCompressed", triangleParams({positionsCompressed: [0, 0, 0, 1]})],
    ["missing aabb", triangleParams({aabb: undefined})],
    ["empty triangle indices", triangleParams({indices: []})],
    ["non-triplet triangle indices", triangleParams({indices: [0, 1]})],
    ["mismatched colorsCompressed", triangleParams({colorsCompressed: [255, 0, 0, 255]})],
    ["mismatched splat scales", {
      id: "g",
      primitive: GaussianSplatsPrimitive,
      positionsCompressed: [0, 0, 0, 65535, 0, 0],
      aabb: [0, 0, 0, 1, 0, 0],
      scales: [1, 1, 1],
    }],
    ["mismatched splat rotations", {
      id: "g",
      primitive: GaussianSplatsPrimitive,
      positionsCompressed: [0, 0, 0, 65535, 0, 0],
      aabb: [0, 0, 0, 1, 0, 0],
      rotations: [0, 0, 0, 1],
    }],
  ])("rejects %s", (_label, params) => {
    const sceneModel = model();

    const result = sceneModel.createGeometryCompressed(params as any);

    expect(result.ok).toBe(false);
    expect(Object.keys(sceneModel.geometries)).toHaveLength(0);
    expect(sceneModel.stats.numGeometries).toBe(0);
    expect(sceneModel.stats.numVertices).toBe(0);
    expect(sceneModel.stats.numTriangles).toBe(0);
  });
});
