import {TrianglesPrimitive} from "../../base/constants";
import type {FloatArrayParam, IntArrayParam} from "../../base/math";
import {collapseAABB3, createAABB3Float64, expandAABB3Point3} from "../../base/math/boundaries";
import {decompressPoint3WithAABB3} from "../../base/math/compression";
import {createMat4Float64, transformPoint3, type Mat4} from "../../base/math/matrix";
import type {SceneObject} from "../scene";
import type {ShellGenerationParams} from "./ShellGenerationParams";
import type {ShellGenerationStats} from "./ShellGenerationStats";

/**
 * One source triangle in world coordinates.
 *
 * @internal
 */
export interface ShellTriangle {
  /** X coordinate of vertex A. */
  ax: number;
  /** Y coordinate of vertex A. */
  ay: number;
  /** Z coordinate of vertex A. */
  az: number;
  /** X coordinate of vertex B. */
  bx: number;
  /** Y coordinate of vertex B. */
  by: number;
  /** Z coordinate of vertex B. */
  bz: number;
  /** X coordinate of vertex C. */
  cx: number;
  /** Y coordinate of vertex C. */
  cy: number;
  /** Z coordinate of vertex C. */
  cz: number;
}

/**
 * Triangle input collected from one or more source scene objects.
 *
 * @internal
 */
export interface ShellSourceTriangles {
  /**
   * Source triangles in world coordinates.
   */
  triangles: ShellTriangle[];

  /**
   * World-space axis-aligned bounding box as
   * `[xmin, ymin, zmin, xmax, ymax, zmax]`.
   */
  aabb: [number, number, number, number, number, number];

  /**
   * Number of source objects scanned.
   */
  sourceObjectCount: number;

  /**
   * Number of source triangles scanned.
   */
  sourceTriangleCount: number;

  /**
   * Number of source vertices scanned.
   */
  sourceVertexCount: number;
}

/**
 * Occupancy grid produced by {@link voxelizeShellTriangles}.
 *
 * @internal
 */
export interface ShellVoxelGrid {
  /**
   * Dense occupancy array. A value of `1` means the voxel intersects source
   * geometry.
   */
  occupied: Uint8Array;

  /**
   * Number of occupied voxels.
   */
  occupiedVoxelCount: number;

  /**
   * World-space origin of voxel `[0, 0, 0]`.
   */
  origin: [number, number, number];

  /**
   * Grid dimensions as `[x, y, z]`.
   */
  dims: [number, number, number];

  /**
   * Edge length of one voxel in world units.
   */
  voxelSize: number;
}

/**
 * Triangle mesh emitted by the shell extraction stage.
 *
 * @internal
 */
export interface ShellMesh {
  /**
   * Flat XYZ position array.
   */
  positions: number[];

  /**
   * Triangle index array.
   */
  indices: number[];
}

/**
 * Complete shell generation result.
 *
 * Coordinate contract:
 *
 * - {@link positions} are shell vertices relative to {@link center}.
 * - {@link center} is the world/model placement for the shell mesh origin.
 * - {@link aabb} is in the same local space as {@link positions}.
 *
 * A runtime shell should therefore create geometry from {@link positions} and
 * place the mesh at {@link center}. Do not add {@link center} to the positions
 * before upload, or the shell will be translated twice.
 *
 * @public
 */
export interface ShellGeneratorResult {
  /**
   * Flat XYZ position array for the generated shell.
   *
   * Coordinates are relative to {@link center}. Add {@link center} only when
   * converting a vertex to world/model coordinates for inspection.
   */
  positions: number[];

  /**
   * Triangle index array for {@link positions}.
   */
  indices: number[];

  /**
   * World/model-space center used as the shell mesh origin.
   */
  center: [number, number, number];

  /**
   * Bounding-sphere radius for projected-size LOD decisions.
   */
  radius: number;

  /**
   * Shell-local axis-aligned bounding box, in the same coordinate space as
   * {@link positions}, as
   * `[xmin, ymin, zmin, xmax, ymax, zmax]`.
   */
  aabb: [number, number, number, number, number, number];

  /**
   * Generation metrics.
   */
  stats: ShellGenerationStats;
}

/**
 * Default longest-axis voxel resolution used when no resolution is supplied.
 *
 * @public
 */
export const DEFAULT_SHELL_RESOLUTION = 64;

/**
 * Maximum accepted longest-axis voxel resolution.
 *
 * @public
 */
export const MAX_SHELL_RESOLUTION = 160;
const EPSILON = 1e-7;
const tempLocal = [0, 0, 0];
const tempWorld = [0, 0, 0];

/**
 * Convenience generator for building shell meshes from scene objects.
 *
 * The class holds no mutable generation state; create one long-lived instance
 * per caller or call {@link generateShellFromSceneObjects} directly.
 *
 * Generated positions are local to the returned
 * {@link ShellGeneratorResult.center}. This keeps large-coordinate source
 * geometry numerically stable and lets runtime code place one shell mesh at the
 * returned center.
 *
 * @example
 * ```javascript
 * import {ShellGenerator} from "@xeokit/sdk/model/lod";
 *
 * const generator = new ShellGenerator();
 * const shell = generator.generate(objects, {
 *   shellResolution: 64,
 *   extraction: "voxelFaces"
 * });
 * ```
 *
 * @public
 */
export class ShellGenerator {
  /**
   * Generates one shell mesh from the given scene objects.
   *
   * @param sceneObjects Source scene objects to approximate.
   * @param params Shell generation options.
   * @returns Generated shell geometry, placement data and metrics. Returned
   * positions are relative to the returned center.
   */
  public generate(sceneObjects: readonly SceneObject[], params: ShellGenerationParams = {}): ShellGeneratorResult {
    return generateShellFromSceneObjects(sceneObjects, params);
  }
}

/**
 * Generates one shell mesh from scene objects.
 *
 * This is the functional equivalent of {@link ShellGenerator.generate}.
 *
 * @param sceneObjects Source scene objects to approximate.
 * @param params Shell generation options.
 * @returns Generated shell geometry, placement data and metrics. Returned
 * positions are relative to the returned center.
 *
 * @public
 */
export function generateShellFromSceneObjects(
  sceneObjects: readonly SceneObject[],
  params: ShellGenerationParams = {}
): ShellGeneratorResult {
  const start = nowMs();
  const source = collectShellSourceTriangles(sceneObjects);
  if (source.triangles.length === 0 || !Number.isFinite(source.aabb[0]) || !Number.isFinite(source.aabb[3])) {
    return emptyResult(sceneObjects.length, start);
  }
  return generateShellFromTriangles(source, params, start);
}

/**
 * Collects triangle input from scene objects.
 *
 * The collector reads triangle primitives with compressed positions, decodes
 * them through each geometry AABB and transforms them by each mesh world matrix.
 * Non-triangle, destroyed or incomplete geometry is skipped.
 *
 * @param sceneObjects Source scene objects to scan.
 * @returns World-space triangles and source metrics.
 *
 * @internal
 */
export function collectShellSourceTriangles(sceneObjects: readonly SceneObject[]): ShellSourceTriangles {
  const triangles: ShellTriangle[] = [];
  const worldAABB = collapseAABB3(createAABB3Float64());
  let sourceTriangleCount = 0;
  let sourceVertexCount = 0;

  for (let objectIndex = 0, objectLen = sceneObjects.length; objectIndex < objectLen; objectIndex++) {
    const sceneObject = sceneObjects[objectIndex];
    if (!sceneObject || sceneObject.destroyed) {
      continue;
    }
    for (let meshIndex = 0, meshLen = sceneObject.meshes.length; meshIndex < meshLen; meshIndex++) {
      const mesh = sceneObject.meshes[meshIndex];
      const geometry = mesh.geometry;
      if (!geometry || geometry.destroyed || geometry.primitive !== TrianglesPrimitive || !geometry.indices) {
        continue;
      }
      const positions = geometry.positionsCompressed;
      const indices = geometry.indices;
      const aabb = geometry.aabb;
      if (!positions || !aabb || !indices || indices.length < 3) {
        continue;
      }
      const matrix = (mesh.worldMatrix ?? mesh.matrix ?? IDENTITY_MATRIX) as Mat4;
      const vertexCount = positions.length / 3;
      sourceVertexCount += vertexCount;
      sourceTriangleCount += indices.length / 3;

      for (let i = 0, len = indices.length; i < len; i += 3) {
        const ia = indices[i] * 3;
        const ib = indices[i + 1] * 3;
        const ic = indices[i + 2] * 3;
        if (ia < 0 || ib < 0 || ic < 0 || ia + 2 >= positions.length || ib + 2 >= positions.length || ic + 2 >= positions.length) {
          continue;
        }
        const a = decodeAndTransform(positions, ia, aabb, matrix);
        const ax = a[0], ay = a[1], az = a[2];
        expandAABB3Point3(worldAABB, a as any);
        const b = decodeAndTransform(positions, ib, aabb, matrix);
        const bx = b[0], by = b[1], bz = b[2];
        expandAABB3Point3(worldAABB, b as any);
        const c = decodeAndTransform(positions, ic, aabb, matrix);
        const cx = c[0], cy = c[1], cz = c[2];
        expandAABB3Point3(worldAABB, c as any);
        triangles.push({ax, ay, az, bx, by, bz, cx, cy, cz});
      }
    }
  }

  return {
    triangles,
    aabb: [
      worldAABB[0], worldAABB[1], worldAABB[2],
      worldAABB[3], worldAABB[4], worldAABB[5]
    ],
    sourceObjectCount: sceneObjects.length,
    sourceTriangleCount,
    sourceVertexCount
  };
}

/**
 * Generates a shell from pre-collected source triangles.
 *
 * Use this when trying several resolutions or extraction modes for the same
 * source objects, because triangle collection can be reused.
 *
 * @param source Pre-collected source triangles.
 * @param params Shell generation options.
 * @param startTimeMs Optional generation start timestamp used for stats.
 * @returns Generated shell geometry, placement data and metrics.
 *
 * @internal
 */
export function generateShellFromTriangles(
  source: ShellSourceTriangles,
  params: ShellGenerationParams = {},
  startTimeMs: number = nowMs()
): ShellGeneratorResult {
  if (source.triangles.length === 0 || !Number.isFinite(source.aabb[0]) || !Number.isFinite(source.aabb[3])) {
    return emptyResult(source.sourceObjectCount, startTimeMs);
  }
  const center = getAABBCenter(source.aabb);
  const sizeX = Math.max(source.aabb[3] - source.aabb[0], EPSILON);
  const sizeY = Math.max(source.aabb[4] - source.aabb[1], EPSILON);
  const sizeZ = Math.max(source.aabb[5] - source.aabb[2], EPSILON);
  const grid = voxelizeShellTriangles(source, params);
  const exterior = floodShellExterior(grid);
  const mesh = extractShellMesh(grid, exterior, center, params.extraction ?? "voxelFaces");
  if (params.extraction === "surfaceNets") {
    smoothShellMesh(mesh.positions, mesh.indices, grid.voxelSize, params.smoothing);
  }
  simplifyShellMesh(mesh.positions, mesh.indices, grid.voxelSize, params.simplification);
  const dx = sizeX * 0.5;
  const dy = sizeY * 0.5;
  const dz = sizeZ * 0.5;
  const radius = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const stats: ShellGenerationStats = {
    sourceObjectCount: source.sourceObjectCount,
    sourceTriangleCount: source.sourceTriangleCount,
    sourceVertexCount: source.sourceVertexCount,
    gridDimensions: grid.dims,
    voxelCount: grid.occupied.length,
    occupiedVoxelCount: grid.occupiedVoxelCount,
    shellTriangleCount: mesh.indices.length / 3,
    shellVertexCount: mesh.positions.length / 3,
    generationTimeMs: nowMs() - startTimeMs,
    triangleReductionRatio: mesh.indices.length > 0 ? source.sourceTriangleCount / (mesh.indices.length / 3) : 0
  };

  return {
    positions: mesh.positions,
    indices: mesh.indices,
    center,
    radius,
    aabb: [
      source.aabb[0] - center[0],
      source.aabb[1] - center[1],
      source.aabb[2] - center[2],
      source.aabb[3] - center[0],
      source.aabb[4] - center[1],
      source.aabb[5] - center[2]
    ],
    stats
  };
}

/**
 * Voxelizes source triangles into a dense occupancy grid.
 *
 * @param source Pre-collected source triangles.
 * @param params Shell generation options that affect grid resolution.
 * @returns Occupancy grid used by the shell extraction stage.
 *
 * @internal
 */
export function voxelizeShellTriangles(source: ShellSourceTriangles, params: ShellGenerationParams = {}): ShellVoxelGrid {
  const sizeX = Math.max(source.aabb[3] - source.aabb[0], EPSILON);
  const sizeY = Math.max(source.aabb[4] - source.aabb[1], EPSILON);
  const sizeZ = Math.max(source.aabb[5] - source.aabb[2], EPSILON);
  const maxSize = Math.max(sizeX, sizeY, sizeZ);
  const requestedResolution = Math.max(2, Math.min(MAX_SHELL_RESOLUTION, Math.floor(params.shellResolution ?? DEFAULT_SHELL_RESOLUTION)));
  const voxelSize = params.voxelSize && params.voxelSize > 0
    ? params.voxelSize
    : maxSize / requestedResolution;
  const nx = Math.max(3, Math.ceil(sizeX / voxelSize) + 2);
  const ny = Math.max(3, Math.ceil(sizeY / voxelSize) + 2);
  const nz = Math.max(3, Math.ceil(sizeZ / voxelSize) + 2);
  const occupied = new Uint8Array(nx * ny * nz);
  const originX = source.aabb[0] - voxelSize;
  const originY = source.aabb[1] - voxelSize;
  const originZ = source.aabb[2] - voxelSize;
  let occupiedVoxelCount = 0;

  for (let i = 0, len = source.triangles.length; i < len; i++) {
    const tri = source.triangles[i];
    const minX = Math.min(tri.ax, tri.bx, tri.cx);
    const minY = Math.min(tri.ay, tri.by, tri.cy);
    const minZ = Math.min(tri.az, tri.bz, tri.cz);
    const maxX = Math.max(tri.ax, tri.bx, tri.cx);
    const maxY = Math.max(tri.ay, tri.by, tri.cy);
    const maxZ = Math.max(tri.az, tri.bz, tri.cz);
    const ix0 = clamp(Math.floor((minX - originX) / voxelSize), 0, nx - 1);
    const iy0 = clamp(Math.floor((minY - originY) / voxelSize), 0, ny - 1);
    const iz0 = clamp(Math.floor((minZ - originZ) / voxelSize), 0, nz - 1);
    const ix1 = clamp(Math.floor((maxX - originX) / voxelSize), 0, nx - 1);
    const iy1 = clamp(Math.floor((maxY - originY) / voxelSize), 0, ny - 1);
    const iz1 = clamp(Math.floor((maxZ - originZ) / voxelSize), 0, nz - 1);

    for (let z = iz0; z <= iz1; z++) {
      for (let y = iy0; y <= iy1; y++) {
        for (let x = ix0; x <= ix1; x++) {
          const cx = originX + (x + 0.5) * voxelSize;
          const cy = originY + (y + 0.5) * voxelSize;
          const cz = originZ + (z + 0.5) * voxelSize;
          if (!triangleIntersectsShellVoxel(tri, cx, cy, cz, voxelSize * 0.5)) {
            continue;
          }
          const index = voxelIndex(x, y, z, nx, ny);
          if (occupied[index] === 0) {
            occupied[index] = 1;
            occupiedVoxelCount++;
          }
        }
      }
    }
  }

  return {
    occupied,
    occupiedVoxelCount,
    origin: [originX, originY, originZ],
    dims: [nx, ny, nz],
    voxelSize
  };
}

/**
 * Flood-fills the empty exterior cells around an occupied voxel grid.
 *
 * @param grid Occupancy grid to classify.
 * @returns Dense array matching `grid.occupied`; `1` marks exterior empty
 * cells.
 *
 * @internal
 */
export function floodShellExterior(grid: ShellVoxelGrid): Uint8Array {
  return floodExterior(grid.occupied, grid.dims[0], grid.dims[1], grid.dims[2]);
}

/**
 * Extracts a shell mesh from a voxel grid and exterior classification.
 *
 * @param grid Occupancy grid.
 * @param exterior Exterior-cell mask from {@link floodShellExterior}.
 * @param center World-space origin to subtract from emitted positions.
 * @param extraction Mesh extraction mode.
 * @returns Generated shell mesh.
 *
 * @internal
 */
export function extractShellMesh(
  grid: ShellVoxelGrid,
  exterior: Uint8Array,
  center: [number, number, number],
  extraction: ShellGenerationParams["extraction"] = "voxelFaces"
): ShellMesh {
  const [nx, ny, nz] = grid.dims;
  const [originX, originY, originZ] = grid.origin;
  return extraction === "surfaceNets"
    ? extractSurfaceNetShellMesh(grid, exterior, center)
    : extractVoxelFaceShellMesh(grid, exterior, center);
}

/**
 * Extracts blocky faces along the exterior boundary of occupied voxels.
 *
 * @param grid Occupancy grid.
 * @param exterior Exterior-cell mask from {@link floodShellExterior}.
 * @param center World-space origin to subtract from emitted positions.
 * @returns Generated shell mesh.
 *
 * @internal
 */
export function extractVoxelFaceShellMesh(
  grid: ShellVoxelGrid,
  exterior: Uint8Array,
  center: [number, number, number]
): ShellMesh {
  const [nx, ny, nz] = grid.dims;
  const [originX, originY, originZ] = grid.origin;
  return emitExteriorFaces(grid.occupied, exterior, nx, ny, nz, originX, originY, originZ, grid.voxelSize, center);
}

/**
 * Extracts a smoother dual mesh from mixed solid/exterior voxel cells.
 *
 * @param grid Occupancy grid.
 * @param exterior Exterior-cell mask from {@link floodShellExterior}.
 * @param center World-space origin to subtract from emitted positions.
 * @returns Generated shell mesh.
 *
 * @internal
 */
export function extractSurfaceNetShellMesh(
  grid: ShellVoxelGrid,
  exterior: Uint8Array,
  center: [number, number, number]
): ShellMesh {
  const [nx, ny, nz] = grid.dims;
  const [originX, originY, originZ] = grid.origin;
  return emitSurfaceNet(grid.occupied, exterior, nx, ny, nz, originX, originY, originZ, grid.voxelSize, center);
}

/**
 * Smooths a generated shell mesh in place.
 *
 * Smoothing is applied only when the smoothing parameter is not `false`.
 *
 * @param positions Flat XYZ position array to modify.
 * @param indices Triangle indices for adjacency.
 * @param voxelSize Grid voxel size, used for displacement limits.
 * @param smoothing Smoothing settings or `false`.
 *
 * @internal
 */
export function smoothShellMesh(
  positions: number[],
  indices: number[],
  voxelSize: number,
  smoothing: ShellGenerationParams["smoothing"]
): void {
  smoothSurfaceNet(positions, indices, voxelSize, smoothing);
}

/**
 * Simplifies a generated shell mesh in place using vertex clustering.
 *
 * @param positions Flat XYZ position array to modify.
 * @param indices Triangle indices to rewrite.
 * @param voxelSize Grid voxel size, used to scale clustering cells.
 * @param simplification Simplification settings or `false`.
 *
 * @internal
 */
export function simplifyShellMesh(
  positions: number[],
  indices: number[],
  voxelSize: number,
  simplification: ShellGenerationParams["simplification"]
): void {
  simplifyMesh(positions, indices, voxelSize, simplification);
}

/**
 * Computes the dense array index for a voxel coordinate.
 *
 * @param x X voxel coordinate.
 * @param y Y voxel coordinate.
 * @param z Z voxel coordinate.
 * @param nx Grid size on the X axis.
 * @param ny Grid size on the Y axis.
 * @returns Dense array index.
 *
 * @internal
 */
export function shellVoxelIndex(x: number, y: number, z: number, nx: number, ny: number): number {
  return voxelIndex(x, y, z, nx, ny);
}

/**
 * Tests whether a triangle intersects an axis-aligned voxel box.
 *
 * @param tri Triangle in world coordinates.
 * @param cx Box center X coordinate.
 * @param cy Box center Y coordinate.
 * @param cz Box center Z coordinate.
 * @param half Half the box edge length.
 * @returns `true` when the triangle intersects the voxel box.
 *
 * @internal
 */
export function triangleIntersectsShellVoxel(tri: ShellTriangle, cx: number, cy: number, cz: number, half: number): boolean {
  return triangleIntersectsBox(tri, cx, cy, cz, half);
}

/**
 * Gets the center point of a shell source AABB.
 *
 * @param aabb Axis-aligned bounding box as
 * `[xmin, ymin, zmin, xmax, ymax, zmax]`.
 * @returns AABB center as `[x, y, z]`.
 *
 * @internal
 */
export function getShellAABBCenter(aabb: ShellSourceTriangles["aabb"]): [number, number, number] {
  return getAABBCenter(aabb);
}

const IDENTITY_MATRIX = createMat4Float64([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function decodeAndTransform(
  positions: IntArrayParam,
  offset: number,
  aabb: FloatArrayParam,
  matrix: Mat4
): number[] {
  tempLocal[0] = positions[offset];
  tempLocal[1] = positions[offset + 1];
  tempLocal[2] = positions[offset + 2];
  decompressPoint3WithAABB3(tempLocal as any, aabb as any, tempLocal as any);
  transformPoint3(matrix, tempLocal as any, tempWorld as any);
  return [tempWorld[0], tempWorld[1], tempWorld[2]];
}

function floodExterior(occupied: Uint8Array, nx: number, ny: number, nz: number): Uint8Array {
  const exterior = new Uint8Array(occupied.length);
  const queue = new Int32Array(occupied.length);
  let head = 0;
  let tail = 0;
  const enqueue = (x: number, y: number, z: number) => {
    const index = voxelIndex(x, y, z, nx, ny);
    if (occupied[index] || exterior[index]) {
      return;
    }
    exterior[index] = 1;
    queue[tail++] = index;
  };
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      enqueue(0, y, z);
      enqueue(nx - 1, y, z);
    }
    for (let x = 0; x < nx; x++) {
      enqueue(x, 0, z);
      enqueue(x, ny - 1, z);
    }
  }
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      enqueue(x, y, 0);
      enqueue(x, y, nz - 1);
    }
  }
  while (head < tail) {
    const index = queue[head++];
    const z = Math.floor(index / (nx * ny));
    const rest = index - z * nx * ny;
    const y = Math.floor(rest / nx);
    const x = rest - y * nx;
    if (x > 0) enqueue(x - 1, y, z);
    if (x + 1 < nx) enqueue(x + 1, y, z);
    if (y > 0) enqueue(x, y - 1, z);
    if (y + 1 < ny) enqueue(x, y + 1, z);
    if (z > 0) enqueue(x, y, z - 1);
    if (z + 1 < nz) enqueue(x, y, z + 1);
  }
  return exterior;
}

function emitExteriorFaces(
  occupied: Uint8Array,
  exterior: Uint8Array,
  nx: number,
  ny: number,
  nz: number,
  originX: number,
  originY: number,
  originZ: number,
  voxelSize: number,
  center: [number, number, number]
): {positions: number[]; indices: number[]} {
  const positions: number[] = [];
  const indices: number[] = [];
  const vertexMap = new Map<string, number>();
  const vertex = (x: number, y: number, z: number): number => {
    const key = `${x},${y},${z}`;
    const existing = vertexMap.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const index = positions.length / 3;
    positions.push(
      originX + x * voxelSize - center[0],
      originY + y * voxelSize - center[1],
      originZ + z * voxelSize - center[2]
    );
    vertexMap.set(key, index);
    return index;
  };
  const addFace = (corners: [number, number, number][]) => {
    const a = vertex(corners[0][0], corners[0][1], corners[0][2]);
    const b = vertex(corners[1][0], corners[1][1], corners[1][2]);
    const c = vertex(corners[2][0], corners[2][1], corners[2][2]);
    const d = vertex(corners[3][0], corners[3][1], corners[3][2]);
    indices.push(a, b, c, a, c, d);
  };
  const isExterior = (x: number, y: number, z: number): boolean => {
    if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) {
      return true;
    }
    return exterior[voxelIndex(x, y, z, nx, ny)] === 1;
  };

  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        if (!occupied[voxelIndex(x, y, z, nx, ny)]) {
          continue;
        }
        if (isExterior(x - 1, y, z)) addFace([[x, y, z], [x, y, z + 1], [x, y + 1, z + 1], [x, y + 1, z]]);
        if (isExterior(x + 1, y, z)) addFace([[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]]);
        if (isExterior(x, y - 1, z)) addFace([[x, y, z], [x + 1, y, z], [x + 1, y, z + 1], [x, y, z + 1]]);
        if (isExterior(x, y + 1, z)) addFace([[x, y + 1, z], [x, y + 1, z + 1], [x + 1, y + 1, z + 1], [x + 1, y + 1, z]]);
        if (isExterior(x, y, z - 1)) addFace([[x, y, z], [x, y + 1, z], [x + 1, y + 1, z], [x + 1, y, z]]);
        if (isExterior(x, y, z + 1)) addFace([[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]]);
      }
    }
  }
  return {positions, indices};
}

function emitSurfaceNet(
  occupied: Uint8Array,
  exterior: Uint8Array,
  nx: number,
  ny: number,
  nz: number,
  originX: number,
  originY: number,
  originZ: number,
  voxelSize: number,
  center: [number, number, number]
): {positions: number[]; indices: number[]} {
  const dx = nx - 1;
  const dy = ny - 1;
  const dz = nz - 1;
  if (dx <= 0 || dy <= 0 || dz <= 0) {
    return {positions: [], indices: []};
  }

  const positions: number[] = [];
  const indices: number[] = [];
  const vertexIds = new Int32Array(dx * dy * dz);
  vertexIds.fill(-1);
  const sampleSolid = (x: number, y: number, z: number): boolean => {
    const index = voxelIndex(x, y, z, nx, ny);
    return occupied[index] === 1 || exterior[index] === 0;
  };
  const samplePoint = (x: number, y: number, z: number): [number, number, number] => [
    originX + (x + 0.5) * voxelSize,
    originY + (y + 0.5) * voxelSize,
    originZ + (z + 0.5) * voxelSize
  ];
  const cubeVertexIndex = (x: number, y: number, z: number): number => x + y * dx + z * dx * dy;

  for (let z = 0; z < dz; z++) {
    for (let y = 0; y < dy; y++) {
      for (let x = 0; x < dx; x++) {
        const signs = [
          sampleSolid(x, y, z),
          sampleSolid(x + 1, y, z),
          sampleSolid(x + 1, y + 1, z),
          sampleSolid(x, y + 1, z),
          sampleSolid(x, y, z + 1),
          sampleSolid(x + 1, y, z + 1),
          sampleSolid(x + 1, y + 1, z + 1),
          sampleSolid(x, y + 1, z + 1)
        ];
        let hasInside = false;
        let hasOutside = false;
        for (let i = 0; i < 8; i++) {
          if (signs[i]) {
            hasInside = true;
          } else {
            hasOutside = true;
          }
        }
        if (!hasInside || !hasOutside) {
          continue;
        }

        const samples = [
          samplePoint(x, y, z),
          samplePoint(x + 1, y, z),
          samplePoint(x + 1, y + 1, z),
          samplePoint(x, y + 1, z),
          samplePoint(x, y, z + 1),
          samplePoint(x + 1, y, z + 1),
          samplePoint(x + 1, y + 1, z + 1),
          samplePoint(x, y + 1, z + 1)
        ];
        const edgePairs = [
          [0, 1], [1, 2], [2, 3], [3, 0],
          [4, 5], [5, 6], [6, 7], [7, 4],
          [0, 4], [1, 5], [2, 6], [3, 7]
        ];
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let crossings = 0;
        for (let i = 0; i < edgePairs.length; i++) {
          const a = edgePairs[i][0];
          const b = edgePairs[i][1];
          if (signs[a] === signs[b]) {
            continue;
          }
          sx += (samples[a][0] + samples[b][0]) * 0.5;
          sy += (samples[a][1] + samples[b][1]) * 0.5;
          sz += (samples[a][2] + samples[b][2]) * 0.5;
          crossings++;
        }
        if (crossings === 0) {
          continue;
        }
        const id = positions.length / 3;
        positions.push(
          sx / crossings - center[0],
          sy / crossings - center[1],
          sz / crossings - center[2]
        );
        vertexIds[cubeVertexIndex(x, y, z)] = id;
      }
    }
  }

  const getVertex = (x: number, y: number, z: number): number => {
    if (x < 0 || y < 0 || z < 0 || x >= dx || y >= dy || z >= dz) {
      return -1;
    }
    return vertexIds[cubeVertexIndex(x, y, z)];
  };
  const addQuad = (a: number, b: number, c: number, d: number, forward: boolean): void => {
    if (a < 0 || b < 0 || c < 0 || d < 0) {
      return;
    }
    if (forward) {
      indices.push(a, b, c, a, c, d);
    } else {
      indices.push(a, d, c, a, c, b);
    }
  };

  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x + 1 < nx; x++) {
        const aSolid = sampleSolid(x, y, z);
        const bSolid = sampleSolid(x + 1, y, z);
        if (aSolid === bSolid || y === 0 || z === 0) {
          continue;
        }
        addQuad(
          getVertex(x, y - 1, z - 1),
          getVertex(x, y, z - 1),
          getVertex(x, y, z),
          getVertex(x, y - 1, z),
          aSolid && !bSolid
        );
      }
    }
  }
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y + 1 < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const aSolid = sampleSolid(x, y, z);
        const bSolid = sampleSolid(x, y + 1, z);
        if (aSolid === bSolid || x === 0 || z === 0) {
          continue;
        }
        addQuad(
          getVertex(x - 1, y, z - 1),
          getVertex(x - 1, y, z),
          getVertex(x, y, z),
          getVertex(x, y, z - 1),
          aSolid && !bSolid
        );
      }
    }
  }
  for (let z = 0; z + 1 < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const aSolid = sampleSolid(x, y, z);
        const bSolid = sampleSolid(x, y, z + 1);
        if (aSolid === bSolid || x === 0 || y === 0) {
          continue;
        }
        addQuad(
          getVertex(x - 1, y - 1, z),
          getVertex(x, y - 1, z),
          getVertex(x, y, z),
          getVertex(x - 1, y, z),
          aSolid && !bSolid
        );
      }
    }
  }

  return {positions, indices};
}

function smoothSurfaceNet(
  positions: number[],
  indices: number[],
  voxelSize: number,
  smoothing: ShellGenerationParams["smoothing"]
): void {
  if (smoothing === false || positions.length === 0 || indices.length === 0) {
    return;
  }
  const iterations = Math.max(0, Math.min(32, Math.floor(smoothing?.iterations ?? 2)));
  if (iterations === 0) {
    return;
  }
  const lambda = smoothing?.lambda ?? 0.5;
  const mu = smoothing?.mu ?? -0.53;
  const maxDisplacement = Math.max(0, smoothing?.maxDisplacementVoxels ?? 0.75) * voxelSize;
  const vertexCount = positions.length / 3;
  const original = positions.slice();
  const current = positions.slice();
  const next = new Array<number>(positions.length);
  const adjacency = buildAdjacency(indices, vertexCount);

  for (let i = 0; i < iterations; i++) {
    smoothPass(current, next, original, adjacency, lambda, maxDisplacement);
    smoothPass(next, current, original, adjacency, mu, maxDisplacement);
  }
  for (let i = 0, len = positions.length; i < len; i++) {
    positions[i] = current[i];
  }
}

function buildAdjacency(indices: number[], vertexCount: number): number[][] {
  const adjacencySets: Set<number>[] = new Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) {
    adjacencySets[i] = new Set<number>();
  }
  const addEdge = (a: number, b: number) => {
    if (a === b || a < 0 || b < 0 || a >= vertexCount || b >= vertexCount) {
      return;
    }
    adjacencySets[a].add(b);
    adjacencySets[b].add(a);
  };
  for (let i = 0, len = indices.length; i < len; i += 3) {
    const a = indices[i];
    const b = indices[i + 1];
    const c = indices[i + 2];
    addEdge(a, b);
    addEdge(b, c);
    addEdge(c, a);
  }
  const adjacency: number[][] = new Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) {
    adjacency[i] = Array.from(adjacencySets[i]);
  }
  return adjacency;
}

function smoothPass(
  source: number[],
  target: number[],
  original: number[],
  adjacency: number[][],
  factor: number,
  maxDisplacement: number
): void {
  for (let vertex = 0, vertexCount = adjacency.length; vertex < vertexCount; vertex++) {
    const neighbors = adjacency[vertex];
    const offset = vertex * 3;
    if (neighbors.length === 0) {
      target[offset] = source[offset];
      target[offset + 1] = source[offset + 1];
      target[offset + 2] = source[offset + 2];
      continue;
    }
    let ax = 0;
    let ay = 0;
    let az = 0;
    for (let i = 0, len = neighbors.length; i < len; i++) {
      const neighborOffset = neighbors[i] * 3;
      ax += source[neighborOffset];
      ay += source[neighborOffset + 1];
      az += source[neighborOffset + 2];
    }
    const inv = 1 / neighbors.length;
    let x = source[offset] + factor * (ax * inv - source[offset]);
    let y = source[offset + 1] + factor * (ay * inv - source[offset + 1]);
    let z = source[offset + 2] + factor * (az * inv - source[offset + 2]);
    if (maxDisplacement > 0) {
      const ox = original[offset];
      const oy = original[offset + 1];
      const oz = original[offset + 2];
      const dx = x - ox;
      const dy = y - oy;
      const dz = z - oz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > maxDisplacement) {
        const scale = maxDisplacement / dist;
        x = ox + dx * scale;
        y = oy + dy * scale;
        z = oz + dz * scale;
      }
    }
    target[offset] = x;
    target[offset + 1] = y;
    target[offset + 2] = z;
  }
}

function simplifyMesh(
  positions: number[],
  indices: number[],
  voxelSize: number,
  simplification: ShellGenerationParams["simplification"]
): void {
  if (simplification === false || positions.length === 0 || indices.length === 0) {
    return;
  }
  const targetTriangleCount = Math.floor(simplification?.targetTriangleCount ?? 0);
  const currentTriangleCount = indices.length / 3;
  if (targetTriangleCount <= 0 || currentTriangleCount <= targetTriangleCount) {
    return;
  }

  const maxClusterSize = Math.max(1, simplification?.maxClusterSizeVoxels ?? 12) * voxelSize;
  const originalPositions = positions.slice();
  const originalIndices = indices.slice();
  let best = {
    positions: originalPositions,
    indices: originalIndices
  };

  for (let multiplier = 1.25; multiplier * voxelSize <= maxClusterSize + EPSILON; multiplier *= 1.35) {
    const clustered = clusterVertices(originalPositions, originalIndices, voxelSize * multiplier);
    if (clustered.indices.length === 0) {
      continue;
    }
    best = clustered;
    if (clustered.indices.length / 3 <= targetTriangleCount) {
      break;
    }
  }

  positions.length = 0;
  indices.length = 0;
  positions.push(...best.positions);
  indices.push(...best.indices);
}

function clusterVertices(
  positions: number[],
  indices: number[],
  cellSize: number
): {positions: number[]; indices: number[]} {
  const cellMap = new Map<string, number>();
  const accumX: number[] = [];
  const accumY: number[] = [];
  const accumZ: number[] = [];
  const counts: number[] = [];
  const remap = new Int32Array(positions.length / 3);

  for (let vertex = 0, vertexCount = positions.length / 3; vertex < vertexCount; vertex++) {
    const offset = vertex * 3;
    const x = positions[offset];
    const y = positions[offset + 1];
    const z = positions[offset + 2];
    const key = `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)},${Math.floor(z / cellSize)}`;
    let cluster = cellMap.get(key);
    if (cluster === undefined) {
      cluster = counts.length;
      cellMap.set(key, cluster);
      accumX.push(0);
      accumY.push(0);
      accumZ.push(0);
      counts.push(0);
    }
    remap[vertex] = cluster;
    accumX[cluster] += x;
    accumY[cluster] += y;
    accumZ[cluster] += z;
    counts[cluster]++;
  }

  const clusteredPositions: number[] = [];
  for (let i = 0, len = counts.length; i < len; i++) {
    const inv = 1 / counts[i];
    clusteredPositions.push(accumX[i] * inv, accumY[i] * inv, accumZ[i] * inv);
  }

  const clusteredIndices: number[] = [];
  const triangleKeys = new Set<string>();
  for (let i = 0, len = indices.length; i < len; i += 3) {
    const a = remap[indices[i]];
    const b = remap[indices[i + 1]];
    const c = remap[indices[i + 2]];
    if (a === b || b === c || c === a) {
      continue;
    }
    const sorted = [a, b, c].sort((x, y) => x - y);
    const key = `${sorted[0]},${sorted[1]},${sorted[2]}`;
    if (triangleKeys.has(key)) {
      continue;
    }
    triangleKeys.add(key);
    clusteredIndices.push(a, b, c);
  }

  return compactMesh(clusteredPositions, clusteredIndices);
}

function compactMesh(
  positions: number[],
  indices: number[]
): {positions: number[]; indices: number[]} {
  const vertexCount = positions.length / 3;
  const used = new Uint8Array(vertexCount);
  for (let i = 0, len = indices.length; i < len; i++) {
    used[indices[i]] = 1;
  }
  const remap = new Int32Array(vertexCount);
  remap.fill(-1);
  const compactedPositions: number[] = [];
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    if (!used[vertex]) {
      continue;
    }
    remap[vertex] = compactedPositions.length / 3;
    const offset = vertex * 3;
    compactedPositions.push(positions[offset], positions[offset + 1], positions[offset + 2]);
  }
  const compactedIndices: number[] = [];
  for (let i = 0, len = indices.length; i < len; i++) {
    compactedIndices.push(remap[indices[i]]);
  }
  return {
    positions: compactedPositions,
    indices: compactedIndices
  };
}

function triangleIntersectsBox(tri: ShellTriangle, cx: number, cy: number, cz: number, half: number): boolean {
  const ax = tri.ax - cx, ay = tri.ay - cy, az = tri.az - cz;
  const bx = tri.bx - cx, by = tri.by - cy, bz = tri.bz - cz;
  const cx0 = tri.cx - cx, cy0 = tri.cy - cy, cz0 = tri.cz - cz;
  if (Math.max(ax, bx, cx0) < -half || Math.min(ax, bx, cx0) > half) return false;
  if (Math.max(ay, by, cy0) < -half || Math.min(ay, by, cy0) > half) return false;
  if (Math.max(az, bz, cz0) < -half || Math.min(az, bz, cz0) > half) return false;

  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const acx = cx0 - ax, acy = cy0 - ay, acz = cz0 - az;
  const nx = aby * acz - abz * acy;
  const ny = abz * acx - abx * acz;
  const nz = abx * acy - aby * acx;
  const planeD = -(nx * ax + ny * ay + nz * az);
  const r = half * (Math.abs(nx) + Math.abs(ny) + Math.abs(nz));
  const s = planeD;
  if (s > r || s < -r) return false;

  return axisTests(ax, ay, az, bx, by, bz, cx0, cy0, cz0, half);
}

function axisTests(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, half: number): boolean {
  const edges = [
    [bx - ax, by - ay, bz - az],
    [cx - bx, cy - by, cz - bz],
    [ax - cx, ay - cy, az - cz]
  ];
  const verts = [[ax, ay, az], [bx, by, bz], [cx, cy, cz]];
  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let e = 0; e < 3; e++) {
    for (let a = 0; a < 3; a++) {
      const ex = edges[e][0], ey = edges[e][1], ez = edges[e][2];
      const ux = axes[a][0], uy = axes[a][1], uz = axes[a][2];
      const tx = ey * uz - ez * uy;
      const ty = ez * ux - ex * uz;
      const tz = ex * uy - ey * ux;
      const len = Math.abs(tx) + Math.abs(ty) + Math.abs(tz);
      if (len < EPSILON) continue;
      let min = Infinity;
      let max = -Infinity;
      for (let v = 0; v < 3; v++) {
        const p = verts[v][0] * tx + verts[v][1] * ty + verts[v][2] * tz;
        min = Math.min(min, p);
        max = Math.max(max, p);
      }
      const r = half * (Math.abs(tx) + Math.abs(ty) + Math.abs(tz));
      if (min > r || max < -r) return false;
    }
  }
  return true;
}

function voxelIndex(x: number, y: number, z: number, nx: number, ny: number): number {
  return x + y * nx + z * nx * ny;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function emptyResult(sourceObjectCount: number, start: number): ShellGeneratorResult {
  return {
    positions: [],
    indices: [],
    center: [0, 0, 0],
    radius: 0,
    aabb: [0, 0, 0, 0, 0, 0],
    stats: {
      sourceObjectCount,
      sourceTriangleCount: 0,
      sourceVertexCount: 0,
      gridDimensions: [0, 0, 0],
      voxelCount: 0,
      occupiedVoxelCount: 0,
      shellTriangleCount: 0,
      shellVertexCount: 0,
      generationTimeMs: nowMs() - start,
      triangleReductionRatio: 0
    }
  };
}

function getAABBCenter(aabb: ShellSourceTriangles["aabb"]): [number, number, number] {
  return [
    (aabb[0] + aabb[3]) * 0.5,
    (aabb[1] + aabb[4]) * 0.5,
    (aabb[2] + aabb[5]) * 0.5
  ];
}

function nowMs(): number {
  return globalThis.performance?.now ? globalThis.performance.now() : Date.now();
}
