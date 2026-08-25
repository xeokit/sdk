import {TrianglesPrimitive} from "../../../base/constants";
import {translationMat4v, type Mat4} from "../../../base/math/matrix";
import {Scene, type SceneModel, type SceneObject} from "../../scene";
import {
  collectShellSourceTriangles,
  extractShellMesh,
  floodShellExterior,
  ShellGenerator,
  voxelizeShellTriangles
} from "../index";

describe("ShellGenerator", () => {
  it("extracts an exterior shell and discards enclosed interior partitions", () => {
    const scene = new Scene();
    const model = scene.createModel({id: "building"}).value!;
    const objectIds: string[] = [];

    addBoxObject(model, "outer", [-10, -5, -2], [10, 5, 2], objectIds);
    for (let i = 0; i < 12; i++) {
      const x = -8 + i * 1.45;
      addWallObject(model, `partition-${i}`, x, -4.5, 4.5, -1.8, 1.8, objectIds);
    }

    const result = new ShellGenerator().generate(objects(scene, objectIds), {shellResolution: 32});

    expect(result.stats.sourceObjectCount).toBe(13);
    expect(result.stats.sourceTriangleCount).toBe(12 + 12 * 2);
    expect(result.stats.occupiedVoxelCount).toBeGreaterThan(0);
    expect(result.stats.shellTriangleCount).toBeGreaterThan(0);
    expect(result.stats.shellTriangleCount).toBeLessThan(result.stats.occupiedVoxelCount * 12);
    expect(result.positions.length % 3).toBe(0);
    expect(result.indices.length % 3).toBe(0);
  });

  it("can extract a smoother surface-net shell", () => {
    const scene = new Scene();
    const model = scene.createModel({id: "surfaceNetBuilding"}).value!;
    const objectIds: string[] = [];

    addBoxObject(model, "outer", [-10, -5, -2], [10, 5, 2], objectIds);
    for (let i = 0; i < 8; i++) {
      const x = -7 + i * 2;
      addWallObject(model, `partition-${i}`, x, -4.5, 4.5, -1.8, 1.8, objectIds);
    }

    const generator = new ShellGenerator();
    const voxelFaces = generator.generate(objects(scene, objectIds), {
      shellResolution: 32,
      extraction: "voxelFaces"
    });
    const surfaceNets = generator.generate(objects(scene, objectIds), {
      shellResolution: 32,
      extraction: "surfaceNets"
    });

    expect(surfaceNets.stats.occupiedVoxelCount).toBe(voxelFaces.stats.occupiedVoxelCount);
    expect(surfaceNets.stats.shellTriangleCount).toBeGreaterThan(0);
    expect(surfaceNets.stats.shellVertexCount).toBeGreaterThan(0);
    expect(surfaceNets.stats.shellTriangleCount).toBeLessThan(voxelFaces.stats.shellTriangleCount);
    expect(surfaceNets.positions.length % 3).toBe(0);
    expect(surfaceNets.indices.length % 3).toBe(0);
  });

  it("smooths surface-net shells without changing topology", () => {
    const scene = new Scene();
    const model = scene.createModel({id: "smoothedSurfaceNet"}).value!;
    const objectIds: string[] = [];

    addBoxObject(model, "outer", [-10, -5, -2], [10, 5, 2], objectIds);
    for (let i = 0; i < 8; i++) {
      addWallObject(model, `partition-${i}`, -7 + i * 2, -4.5, 4.5, -1.8, 1.8, objectIds);
    }

    const generator = new ShellGenerator();
    const unsmoothed = generator.generate(objects(scene, objectIds), {
      shellResolution: 32,
      extraction: "surfaceNets",
      smoothing: false
    });
    const smoothed = generator.generate(objects(scene, objectIds), {
      shellResolution: 32,
      extraction: "surfaceNets",
      smoothing: {
        iterations: 4,
        maxDisplacementVoxels: 0.5
      }
    });

    expect(smoothed.stats.shellTriangleCount).toBe(unsmoothed.stats.shellTriangleCount);
    expect(smoothed.stats.shellVertexCount).toBe(unsmoothed.stats.shellVertexCount);
    expect(totalPositionDelta(smoothed.positions, unsmoothed.positions)).toBeGreaterThan(0);
  });

  it("can simplify surface-net shells toward a triangle budget", () => {
    const scene = new Scene();
    const model = scene.createModel({id: "simplifiedSurfaceNet"}).value!;
    const objectIds: string[] = [];

    addBoxObject(model, "outer", [-10, -5, -2], [10, 5, 2], objectIds);
    for (let i = 0; i < 10; i++) {
      addWallObject(model, `partition-${i}`, -8 + i * 1.6, -4.5, 4.5, -1.8, 1.8, objectIds);
    }

    const generator = new ShellGenerator();
    const unsimplified = generator.generate(objects(scene, objectIds), {
      shellResolution: 48,
      extraction: "surfaceNets",
      smoothing: false,
      simplification: false
    });
    const simplified = generator.generate(objects(scene, objectIds), {
      shellResolution: 48,
      extraction: "surfaceNets",
      smoothing: {
        iterations: 2
      },
      simplification: {
        targetTriangleCount: 1000,
        maxClusterSizeVoxels: 8
      }
    });

    expect(simplified.stats.shellTriangleCount).toBeGreaterThan(0);
    expect(simplified.stats.shellTriangleCount).toBeLessThan(unsimplified.stats.shellTriangleCount);
    expect(simplified.positions.length % 3).toBe(0);
    expect(simplified.indices.length % 3).toBe(0);
  });

  it("handles open single-sided triangle soup predictably", () => {
    const scene = new Scene();
    const model = scene.createModel({id: "open"}).value!;
    const objectIds: string[] = [];
    addWallObject(model, "open-wall", 0, -5, 5, -2, 2, objectIds);

    const result = new ShellGenerator().generate(objects(scene, objectIds), {shellResolution: 32});

    expect(result.stats.sourceTriangleCount).toBe(2);
    expect(result.stats.occupiedVoxelCount).toBeGreaterThan(0);
    expect(result.stats.shellTriangleCount).toBeGreaterThan(0);
    expect(result.stats.triangleReductionRatio).toBeLessThan(1);
  });

  it("keeps disconnected components in one shell mesh", () => {
    const scene = new Scene();
    const model = scene.createModel({id: "disconnected"}).value!;
    const objectIds: string[] = [];
    addBoxObject(model, "a", [-6, -1, -1], [-4, 1, 1], objectIds);
    addBoxObject(model, "b", [4, -1, -1], [6, 1, 1], objectIds);

    const result = new ShellGenerator().generate(objects(scene, objectIds), {shellResolution: 32});

    expect(result.stats.sourceObjectCount).toBe(2);
    expect(result.stats.gridDimensions[0]).toBeGreaterThan(result.stats.gridDimensions[1]);
    expect(result.stats.shellTriangleCount).toBeGreaterThan(0);
  });

  it("emits shell positions relative to the returned center for far-from-origin geometry", () => {
    const scene = new Scene();
    const model = scene.createModel({id: "farOrigin"}).value!;
    const objectIds: string[] = [];
    addBoxObject(model, "far", [1000, 2000, -500], [1004, 2006, -496], objectIds);

    const result = new ShellGenerator().generate(objects(scene, objectIds), {
      shellResolution: 16,
      extraction: "voxelFaces"
    });

    expect(result.center[0]).toBeCloseTo(1002);
    expect(result.center[1]).toBeCloseTo(2003);
    expect(result.center[2]).toBeCloseTo(-498);
    expect(result.aabb[0]).toBeCloseTo(-2);
    expect(result.aabb[1]).toBeCloseTo(-3);
    expect(result.aabb[2]).toBeCloseTo(-2);
    expect(result.aabb[3]).toBeCloseTo(2);
    expect(result.aabb[4]).toBeCloseTo(3);
    expect(result.aabb[5]).toBeCloseTo(2);
    expect(Math.max(...result.positions.map((value) => Math.abs(value)))).toBeLessThan(5);
  });

  it("collects triangles through source object mesh transforms", () => {
    const scene = new Scene();
    const model = scene.createModel({id: "transformed"}).value!;
    const objectIds: string[] = [];
    addBoxObject(
      model,
      "translated",
      [0, 0, 0],
      [2, 4, 6],
      objectIds,
      translationMat4v([50, -20, 10] as any)
    );

    const source = collectShellSourceTriangles(objects(scene, objectIds));
    const result = new ShellGenerator().generate(objects(scene, objectIds), {
      shellResolution: 16,
      extraction: "voxelFaces"
    });

    expect(source.aabb[0]).toBeCloseTo(50);
    expect(source.aabb[1]).toBeCloseTo(-20);
    expect(source.aabb[2]).toBeCloseTo(10);
    expect(source.aabb[3]).toBeCloseTo(52);
    expect(source.aabb[4]).toBeCloseTo(-16);
    expect(source.aabb[5]).toBeCloseTo(16);
    expect(result.center[0]).toBeCloseTo(51);
    expect(result.center[1]).toBeCloseTo(-18);
    expect(result.center[2]).toBeCloseTo(13);
    expect(Math.max(...result.positions.map((value) => Math.abs(value)))).toBeLessThan(4);
  });

  it("exposes the expected failure mode for sparse thin framing", () => {
    const scene = new Scene();
    const model = scene.createModel({id: "framing"}).value!;
    const objectIds: string[] = [];
    for (let i = 0; i < 8; i++) {
      addBoxObject(model, `beam-${i}`, [-8, -0.05, i * 0.8], [8, 0.05, i * 0.8 + 0.1], objectIds);
    }

    const coarse = new ShellGenerator().generate(objects(scene, objectIds), {shellResolution: 16});
    const finer = new ShellGenerator().generate(objects(scene, objectIds), {shellResolution: 64});

    expect(coarse.stats.shellTriangleCount).toBeGreaterThan(0);
    expect(finer.stats.shellTriangleCount).toBeGreaterThanOrEqual(coarse.stats.shellTriangleCount);
  });
  it("exposes the generation pipeline as independent utilities", () => {
    const scene = new Scene();
    const model = scene.createModel({id: "pipeline"}).value!;
    const objectIds: string[] = [];
    addBoxObject(model, "outer", [-2, -2, -2], [2, 2, 2], objectIds);

    const source = collectShellSourceTriangles(objects(scene, objectIds));
    const grid = voxelizeShellTriangles(source, {shellResolution: 16});
    const exterior = floodShellExterior(grid);
    const mesh = extractShellMesh(grid, exterior, [0, 0, 0], "voxelFaces");

    expect(source.triangles.length).toBeGreaterThan(0);
    expect(grid.occupiedVoxelCount).toBeGreaterThan(0);
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
  });
});

function objects(scene: Scene, ids: string[]): SceneObject[] {
  return ids.map((id) => scene.objects[id]);
}

function totalPositionDelta(a: number[], b: number[]): number {
  let delta = 0;
  for (let i = 0, len = Math.min(a.length, b.length); i < len; i++) {
    delta += Math.abs(a[i] - b[i]);
  }
  return delta;
}

function addWallObject(
  model: SceneModel,
  id: string,
  x: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  objectIds: string[]
): void {
  addObject(model, id, [
    x, y0, z0,
    x, y1, z0,
    x, y1, z1,
    x, y0, z1
  ], [0, 1, 2, 0, 2, 3], objectIds);
}

function addBoxObject(
  model: SceneModel,
  id: string,
  min: [number, number, number],
  max: [number, number, number],
  objectIds: string[],
  matrix?: Mat4
): void {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  addObject(model, id, [
    x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0,
    x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1
  ], [
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6,
    3, 0, 4, 3, 4, 7
  ], objectIds, matrix);
}

function addObject(
  model: SceneModel,
  id: string,
  positions: number[],
  indices: number[],
  objectIds: string[],
  matrix?: Mat4
): void {
  expect(model.createGeometry({
    id: `${id}-geometry`,
    primitive: TrianglesPrimitive,
    positions,
    indices
  }).ok).toBe(true);
  expect(model.createMesh({
    id: `${id}-mesh`,
    geometryId: `${id}-geometry`,
    matrix
  }).ok).toBe(true);
  expect(model.createObject({
    id,
    meshIds: [`${id}-mesh`]
  }).ok).toBe(true);
  objectIds.push(id);
}
