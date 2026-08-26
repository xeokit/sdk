import {SDKErrorType, type SDKResult} from "@xeokit/sdk/base/core";
import {SolidPrimitive, SurfacePrimitive, TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import type {SceneMesh, SceneModel, SceneObject} from "@xeokit/sdk/model/scene";
import type {FloatArrayParam} from "@xeokit/sdk/base/math";
import type {Vec3} from "@xeokit/sdk/base/math/vector";
import {decompressPositions3WithAABB3} from "@xeokit/sdk/base/math/compression";
import {transformPoint3} from "@xeokit/sdk/base/math/matrix";
import {
  pointInPolygon2DFlat,
  polygonSignedArea2DFlat,
} from "@xeokit/sdk/base/math/polygon2D";
import {earcut} from "@xeokit/sdk/formats/cityjson/versions/v1_0/earcut";

import type {CapPlane} from "./CapPlane";
import type {BuildSectionCapsParams} from "./BuildSectionCapsParams";
import type {BuildSectionCapsResult} from "./BuildSectionCapsResult";
import type {ProgressiveSpec} from "./ProgressiveSpec";

/**
 * Vertex-on-plane epsilon, expressed as a fraction of the mesh's
 * world-space AABB diagonal.
 *
 * A vertex is treated as "on" the plane when its signed distance
 * is within `mesh.diagonal × EPS_PLANE_REL`. Scaling by mesh size
 * lets the same algorithm produce stable classifications across
 * scenes that differ by orders of magnitude in unit choice
 * (kilometre-scale terrains, millimetre-scale parts).
 */
const EPS_PLANE_REL = 1e-7;

/**
 * Endpoint-match tolerance for stitching segment soup into loops,
 * as a fraction of the mesh's world-space AABB diagonal.
 *
 * One order of magnitude looser than {@link EPS_PLANE_REL} so two
 * segments that emerge from numerically-near triangle crossings on
 * adjacent triangles stitch reliably, while still being much
 * tighter than any real triangle edge length.
 */
const EPS_STITCH_REL = 1e-6;

/**
 * Lower bound applied to the derived plane / stitch epsilons,
 * regardless of mesh diagonal. Guards against the degenerate
 * "every vertex coincident" case (diagonal = 0) producing a
 * zero-tolerance comparison.
 */
const EPS_FLOOR = 1e-12;

/**
 * Per-mesh numerical tolerances, scaled from the mesh's
 * world-space AABB diagonal.
 */
interface MeshEpsilons {
  /** Vertex-on-plane classification tolerance, world units. */
  plane: number;
  /** Endpoint-match tolerance for stitching, world units. */
  stitch: number;
}

/**
 * Cap-fill colour used when no `capColor` is supplied and the
 * source mesh has neither a material colour nor a mesh-level
 * colour to inherit from.
 */
const DEFAULT_CAP_COLOR: Vec3 = [0.55, 0.56, 0.58];

/**
 * Generates section cap geometry where the supplied planes slice
 * through the source model.
 *
 * For every source {@link model!scene.SceneMesh | SceneMesh} whose primitive is
 * triangle-bearing ({@link base!constants.SolidPrimitive | SolidPrimitive},
 * {@link base!constants.SurfacePrimitive | SurfacePrimitive}, or
 * {@link base!constants.TrianglesPrimitive | TrianglesPrimitive}) and whose triangles
 * straddle any of {@link BuildSectionCapsParams.capPlanes | capPlanes},
 * the extractor:
 *
 *   1. Computes the line segments where each straddling triangle
 *      crosses the plane, oriented so the resulting boundary
 *      winds counter-clockwise when viewed from the clipped
 *      half-space (camera positioned along `+dir`). The emitted
 *      cap face normal is therefore `+dir`, which makes the cap
 *      front-facing under default back-face culling for the
 *      typical sectioning configuration where the viewer looks
 *      at the cut from the side that was cut away.
 *   2. Stitches the segments into closed loops by matching
 *      endpoints within a mesh-relative stitching tolerance
 *      (see `EPS_STITCH_REL`). Open polylines (caused
 *      by non-watertight source meshes) are discarded.
 *   3. Trims each loop against the kept half-space of every
 *      *other* plane in `capPlanes` using Sutherland-Hodgman, so
 *      caps from intersecting cut planes don't overlap.
 *   4. Classifies each surviving loop as an outer ring or a
 *      hole by its signed area in tangent-space 2D (outer rings
 *      wind CCW, holes CW under the cap convention), attaches
 *      each hole to its tightest containing outer, and
 *      triangulates each outer-plus-holes group with `earcut`.
 *      Cross-sections through hollow members (pipes, walls with
 *      openings) therefore render with their interiors open
 *      rather than filled.
 *   5. Emits a `TrianglesPrimitive` {@link model!scene.SceneGeometry | SceneGeometry},
 *      a {@link model!scene.SceneMaterial | SceneMaterial} carrying the source
 *      material's `hatchPattern` (if any) on top of the resolved
 *      cap colour, and a {@link model!scene.SceneMesh | SceneMesh} bound
 *      to both. One {@link model!scene.SceneObject | SceneObject} is
 *      created per source object that contributed at least one
 *      cap, listing every cap mesh it produced.
 *
 * Meshes whose primitive isn't triangle-bearing
 * ({@link base!constants.LinesPrimitive | LinesPrimitive}, {@link base!constants.PointsPrimitive | PointsPrimitive})
 * are skipped — they have no triangles to clip. Open shells
 * tagged as {@link base!constants.SurfacePrimitive | SurfacePrimitive} are walked, but
 * typically produce no caps because their cap segments fail to
 * stitch into a closed loop (they're counted in
 * `numUnclosedMeshes`).
 *
 * Source and target {@link model!scene.SceneModel | SceneModels} may
 * live in different {@link model!scene.Scene | Scenes} — the function
 * only reads source geometry and writes target components.
 *
 * Returns counts via {@link BuildSectionCapsResult} on success. On
 * failure, partial state may have been written to the caller-owned
 * target; the caller is responsible for tearing it down. When
 * `progressive` is enabled, the function awaits a yield every
 * `batchSize` source objects so the renderer can paint partial
 * results; a caller-driven `targetModel.destroy()` between yields
 * bails the loop cleanly at the next batch boundary.
 *
 * See the website example Studio section-cap tools
 * for end-to-end usage examples.
 */
export async function buildSectionCaps(
  params: BuildSectionCapsParams,
): Promise<SDKResult<BuildSectionCapsResult>> {

  const source = params.sourceModel;
  const target = params.targetModel;
  const capPlanes = params.capPlanes;

  if (!source || source.destroyed) {
    return {
      ok: false, type: SDKErrorType.InvalidInput,
      error: "[buildSectionCaps] sourceModel is missing or destroyed",
    };
  }
  if (!target || target.destroyed) {
    return {
      ok: false, type: SDKErrorType.InvalidInput,
      error: "[buildSectionCaps] targetModel is missing or destroyed",
    };
  }
  if (!capPlanes || capPlanes.length === 0) {
    return {
      ok: false, type: SDKErrorType.InvalidInput,
      error: "[buildSectionCaps] 'capPlanes' must be a non-empty array",
    };
  }

  const planeFrames: PlaneFrame[] = capPlanes.map(buildPlaneFrame);
  const overrideCapColor = params.capColor;
  const idPrefix = params.idPrefix ?? "cap";
  const layerId = params.layerId;

  // Object-id filters: normalise array shapes to Set for O(1)
  // membership tests in the hot loop. Predicate stays as a plain
  // callback. All three conditions AND together when present.
  const includeIds = toIdSet(params.includeObjectIds);
  const excludeIds = toIdSet(params.excludeObjectIds);
  const includeObject = params.includeObject;

  // Progressive yields — when enabled, the per-source-object loop
  // awaits `yieldFn()` every `batchSize` objects so the renderer
  // can paint the partial caps. Pure microtask overhead when
  // disabled (the async function still returns a Promise; the body
  // just never `await`s).
  const progressiveSpec: ProgressiveSpec | null =
    typeof params.progressive === "object"
      ? params.progressive as ProgressiveSpec
      : params.progressive
        ? {}
        : null;
  const batchSize = Math.max(1, progressiveSpec?.batchSize ?? 50);
  const yieldFn = progressiveSpec?.yield ?? defaultYield;
  let objectsSinceYield = 0;

  let numObjectsWithCaps = 0;
  let numCapMeshes = 0;
  let numUnclosedMeshes = 0;

  for (const sourceObjectId of Object.keys(source.objects)) {
    const sourceObject = source.objects[sourceObjectId];

    // Skip filtered-out objects before walking their meshes — the
    // mesh loop is the expensive part, so filter early.
    if (includeIds && !includeIds.has(sourceObjectId)) continue;
    if (excludeIds && excludeIds.has(sourceObjectId)) continue;
    if (includeObject && !includeObject(sourceObject)) continue;

    const capMeshIds: string[] = [];

    for (const sourceMesh of sourceObject.meshes) {
      const prim = sourceMesh.geometry.primitive;
      if (prim !== SolidPrimitive
        && prim !== SurfacePrimitive
        && prim !== TrianglesPrimitive) continue;

      const meshData = decompressMeshToWorld(sourceMesh);
      if (!meshData) continue;
      const eps = meshEpsilons(meshData.diagonal);

      // Resolve effective cap colour per source mesh. Explicit
      // `params.capColor` always wins; otherwise inherit from the
      // source material (the renderer's effective colour when a
      // material is bound), fall back to the per-mesh colour, then
      // to the neutral grey default.
      const capColor = overrideCapColor
        ?? sourceMesh.material?.color
        ?? sourceMesh.color
        ?? DEFAULT_CAP_COLOR;

      for (let planeIndex = 0; planeIndex < planeFrames.length; planeIndex++) {
        const polygon = buildCapForMeshOnPlane(
          meshData.positions,
          sourceMesh.geometry.indices as ArrayLike<number>,
          planeFrames,
          planeIndex,
          eps,
        );
        if (polygon === "unclosed") {
          numUnclosedMeshes++;
          continue;
        }
        if (!polygon) continue;

        const baseId = `${idPrefix}__${sourceObjectId}__${sourceMesh.id}__p${planeIndex}`;
        const geomId = baseId;
        const matId = `${baseId}__mat`;
        const meshId = baseId;

        const geomResult = target.createGeometry({
          id: geomId,
          primitive: TrianglesPrimitive,
          positions: polygon.positions,
          indices: polygon.indices,
        });
        if (!geomResult.ok) return geomResult as SDKResult<BuildSectionCapsResult>;

        const matResult = target.createMaterial({
          id: matId,
          color: capColor,
          hatchPattern: sourceMesh.material?.hatchPattern,
        });
        if (!matResult.ok) return matResult as SDKResult<BuildSectionCapsResult>;

        const meshResult = target.createMesh({
          id: meshId,
          geometryId: geomId,
          materialId: matId,
        });
        if (!meshResult.ok) return meshResult as SDKResult<BuildSectionCapsResult>;

        capMeshIds.push(meshId);
        numCapMeshes++;
      }
    }

    if (capMeshIds.length > 0) {
      const objectId = `${idPrefix}__${sourceObjectId}`;
      const objResult = target.createObject({
        id: objectId,
        originalSystemId: sourceObjectId,
        meshIds: capMeshIds,
        ...(layerId ? {layerId} : {}),
      });
      if (!objResult.ok) return objResult as SDKResult<BuildSectionCapsResult>;
      numObjectsWithCaps++;
    }

    // Yield every `batchSize` source objects so the renderer can
    // paint partial caps. After the yield, bail cleanly if the
    // caller's teardown destroyed the target SceneModel while we
    // were suspended.
    if (progressiveSpec) {
      objectsSinceYield++;
      if (objectsSinceYield >= batchSize) {
        objectsSinceYield = 0;
        await yieldFn();
        if (target.destroyed) {
          return {
            ok: false,
            type: SDKErrorType.InvalidOperation,
            error: `[buildSectionCaps] target model '${target.id}' was destroyed mid-build`,
          };
        }
      }
    }
  }

  return {
    ok: true,
    value: {numObjectsWithCaps, numCapMeshes, numUnclosedMeshes},
  };
}


/**
 * Quick scan to check whether `sourceModel` has any geometry the
 * cap builder can usefully consume. Lets callers (panels, batch
 * tools) skip the call entirely when the source is e.g. a point
 * cloud or a line-only model, instead of letting
 * {@link buildSectionCaps} run and emit zero caps.
 *
 * Returns `true` as soon as it finds the first triangle-flavoured
 * geometry ({@link base!constants.TrianglesPrimitive | TrianglesPrimitive},
 * {@link base!constants.SolidPrimitive | SolidPrimitive}, or
 * {@link base!constants.SurfacePrimitive | SurfacePrimitive}) with a
 * non-empty `indices` buffer.
 */
export function canBuildSectionCaps(sourceModel: SceneModel): boolean {
  if (!sourceModel || sourceModel.destroyed) return false;
  for (const objectId of Object.keys(sourceModel.objects)) {
    const obj = sourceModel.objects[objectId];
    for (const mesh of obj.meshes) {
      const geom = mesh.geometry;
      if (!geom) continue;
      const prim = geom.primitive;
      if (prim !== TrianglesPrimitive
        && prim !== SolidPrimitive
        && prim !== SurfacePrimitive) continue;
      if (geom.indices && geom.indices.length >= 3) return true;
    }
  }
  return false;
}


/**
 * Removes a target {@link model!scene.SceneModel | SceneModel} previously
 * populated by {@link buildSectionCaps}. No-op if the model is null
 * or already destroyed. Equivalent to `targetModel.destroy()` with
 * a destroyed-check; provided as a convenience for symmetry with
 * {@link buildSectionCaps}.
 */
export function clearSectionCaps(targetModel: SceneModel | null | undefined): void {
  if (targetModel && !targetModel.destroyed) targetModel.destroy();
}


/**
 * Normalise an array-or-Set id collection into a Set for O(1)
 * membership lookups in the source-object loop. Returns `undefined`
 * when the input is missing or empty so the loop can skip the
 * lookup entirely.
 */
function toIdSet(ids: ReadonlyArray<string> | ReadonlySet<string> | undefined): ReadonlySet<string> | undefined {
  if (!ids) return undefined;
  if (ids instanceof Set) return ids.size > 0 ? ids : undefined;
  const arr = ids as ReadonlyArray<string>;
  return arr.length > 0 ? new Set(arr) : undefined;
}


/**
 * Default progressive-yield callback. Resolves on the next
 * `requestAnimationFrame` tick in the browser (so emitted geometry
 * paints between batches) and on a microtask elsewhere (Node,
 * tests).
 */
function defaultYield(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

// ────────────────────────────────────────────────────────────────────
// Plane frames
// ────────────────────────────────────────────────────────────────────

/**
 * Normalised representation of a {@link CapPlane} plus an
 * orthonormal in-plane basis. The basis is used to project cap
 * loops to 2D for triangulation; choice of tangent is arbitrary
 * (any in-plane direction works) — the resulting triangulation is
 * topologically equivalent regardless of orientation.
 */
interface PlaneFrame {
  dir: Vec3;       // unit normal; outward into clipped half-space
  dist: number;    // plane constant: dot(dir, p) + dist = 0 on the plane
  tangent: Vec3;   // unit, in-plane
  bitangent: Vec3; // unit, in-plane, = dir × tangent
}

function buildPlaneFrame(plane: CapPlane): PlaneFrame {
  const lx = plane.dir[0], ly = plane.dir[1], lz = plane.dir[2];
  const len = Math.hypot(lx, ly, lz);
  if (len < 1e-12) {
    return {
      dir: [0, 0, 1], dist: plane.dist,
      tangent: [1, 0, 0], bitangent: [0, 1, 0],
    };
  }
  const inv = 1.0 / len;
  const dir: Vec3 = [lx * inv, ly * inv, lz * inv];
  const dist = plane.dist * inv;
  // Pick a stable reference axis non-parallel to dir.
  const ref: Vec3 = Math.abs(dir[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const d = ref[0] * dir[0] + ref[1] * dir[1] + ref[2] * dir[2];
  const tx = ref[0] - d * dir[0];
  const ty = ref[1] - d * dir[1];
  const tz = ref[2] - d * dir[2];
  const tlen = Math.hypot(tx, ty, tz) || 1;
  const tangent: Vec3 = [tx / tlen, ty / tlen, tz / tlen];
  const bitangent: Vec3 = [
    dir[1] * tangent[2] - dir[2] * tangent[1],
    dir[2] * tangent[0] - dir[0] * tangent[2],
    dir[0] * tangent[1] - dir[1] * tangent[0],
  ];
  return {dir, dist, tangent, bitangent};
}

// ────────────────────────────────────────────────────────────────────
// Vertex decompression
// ────────────────────────────────────────────────────────────────────

/**
 * Source mesh decompressed into world-space positions, with the
 * world-space AABB diagonal recorded alongside for use as a length
 * reference when deriving numerical tolerances.
 */
interface MeshWorldData {
  /** Flat `[x, y, z, ...]` world-space positions. */
  positions: Float32Array;
  /** Diagonal of the mesh's world-space AABB, in world units. */
  diagonal: number;
}

function decompressMeshToWorld(mesh: SceneMesh): MeshWorldData | null {
  const geom = mesh.geometry;
  if (!geom.positionsCompressed || !geom.aabb || !geom.indices) return null;

  const local = decompressPositions3WithAABB3(
    geom.positionsCompressed as FloatArrayParam,
    geom.aabb,
  );
  const wm = mesh.worldMatrix;
  const nVerts = local.length / 3;
  const world = new Float32Array(local.length);
  const inP: Vec3 = [0, 0, 0];
  const outP: Vec3 = [0, 0, 0];
  let minX = +Infinity, minY = +Infinity, minZ = +Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < nVerts; i++) {
    inP[0] = local[i * 3];
    inP[1] = local[i * 3 + 1];
    inP[2] = local[i * 3 + 2];
    transformPoint3(wm, inP, outP);
    const x = outP[0], y = outP[1], z = outP[2];
    world[i * 3] = x;
    world[i * 3 + 1] = y;
    world[i * 3 + 2] = z;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const diagonal = nVerts > 0
    ? Math.hypot(maxX - minX, maxY - minY, maxZ - minZ)
    : 0;
  return {positions: world, diagonal};
}

/**
 * Derives per-mesh plane / stitch tolerances from the mesh's
 * world-space AABB diagonal. See {@link EPS_PLANE_REL} and
 * `EPS_STITCH_REL` for the scaling rationale.
 */
function meshEpsilons(diagonal: number): MeshEpsilons {
  return {
    plane:  Math.max(diagonal * EPS_PLANE_REL,  EPS_FLOOR),
    stitch: Math.max(diagonal * EPS_STITCH_REL, EPS_FLOOR),
  };
}

// ────────────────────────────────────────────────────────────────────
// Cap extraction
// ────────────────────────────────────────────────────────────────────

interface CapPolygon {
  positions: Float32Array;
  indices: Uint32Array;
}

/**
 * Builds the cap polygon for one mesh on one plane, post-clipped
 * against the other planes in the set.
 *
 * Returns:
 *   - A populated {@link CapPolygon} when the mesh crosses the
 *     plane and at least one closed loop survives the multi-plane
 *     clip.
 *   - `null` when the mesh and plane never interact (no straddling
 *     triangles).
 *   - `"unclosed"` when straddling triangles exist but their
 *     segments do not form a closed boundary, typically caused by
 *     non-watertight source geometry.
 */
function buildCapForMeshOnPlane(
  world: Float32Array,
  indices: ArrayLike<number>,
  planeFrames: PlaneFrame[],
  activePlaneIndex: number,
  eps: MeshEpsilons,
): CapPolygon | null | "unclosed" {

  const frame = planeFrames[activePlaneIndex];
  const nVerts = world.length / 3;

  // Signed distance per vertex to the active plane.
  const dist = new Float32Array(nVerts);
  for (let i = 0; i < nVerts; i++) {
    dist[i] =
      frame.dir[0] * world[i * 3] +
      frame.dir[1] * world[i * 3 + 1] +
      frame.dir[2] * world[i * 3 + 2] +
      frame.dist;
  }

  const segments = extractCapSegments(world, dist, indices, eps, frame.dir);
  if (segments.length === 0) return null;

  const loops = stitchSegmentsIntoLoops(segments, eps);
  if (loops.length === 0) return "unclosed";

  // Trim each loop against the kept half-space of every OTHER plane.
  const clippedLoops: number[][] = [];
  for (const loop of loops) {
    let poly = loop;
    for (let pi = 0; pi < planeFrames.length; pi++) {
      if (pi === activePlaneIndex) continue;
      poly = clipPolygonAgainstHalfSpace(poly, planeFrames[pi], eps);
      if (poly.length < 9) break;
    }
    if (poly.length >= 9) clippedLoops.push(poly);
  }
  if (clippedLoops.length === 0) return null;

  // Project each clipped loop into tangent-bitangent 2D and
  // classify by signed area. With the section-cap winding
  // convention (CCW from +dir), outer rings have positive
  // signed area; hole rings (inner boundaries of cross-sections
  // through hollow members) have negative signed area.
  const rings: RingData[] = [];
  for (const loop of clippedLoops) {
    const loop2D: number[] = [];
    for (let i = 0; i < loop.length; i += 3) {
      const wx = loop[i], wy = loop[i + 1], wz = loop[i + 2];
      loop2D.push(
        wx * frame.tangent[0] + wy * frame.tangent[1] + wz * frame.tangent[2],
        wx * frame.bitangent[0] + wy * frame.bitangent[1] + wz * frame.bitangent[2],
      );
    }
    const area = polygonSignedArea2DFlat(loop2D);
    if (area === 0) continue; // collinear / degenerate ring
    rings.push({loop2D, loop3D: loop, signedArea: area});
  }

  const outers: RingData[] = [];
  const holes:  RingData[] = [];
  for (const r of rings) {
    if (r.signedArea > 0) outers.push(r); else holes.push(r);
  }

  // No outer ring → either the cross-section is empty (after
  // multi-plane clipping) or the source mesh has inverted
  // winding so what should be outers came out CW. Skip rather
  // than emit back-facing caps.
  if (outers.length === 0) return null;

  // Attach each hole to its tightest containing outer. The
  // hole's first vertex sits on the hole boundary; for properly
  // nested cross-sections the hole boundary is strictly interior
  // to the parent outer, so the first vertex is unambiguously
  // inside. Smallest-area containment picks the tightest parent
  // when an outer-inside-outer pattern exists (rare but real for
  // multi-walled members).
  interface OuterGroup {outer: RingData; holes: RingData[];}
  const groups: OuterGroup[] = outers.map(o => ({outer: o, holes: []}));
  for (const hole of holes) {
    const px = hole.loop2D[0], py = hole.loop2D[1];
    let parent: OuterGroup | null = null;
    let parentArea = Infinity;
    for (const g of groups) {
      if (!pointInPolygon2DFlat(px, py, g.outer.loop2D)) continue;
      const a = g.outer.signedArea;
      if (a < parentArea) { parent = g; parentArea = a; }
    }
    if (parent) parent.holes.push(hole);
    // Orphan holes (no containing outer) are dropped silently —
    // they would render as discs filling phantom regions.
  }

  // Triangulate each outer with its holes. Earcut wants the
  // outer ring first (CCW), then each hole (CW) appended to the
  // same flat coord array, with `holeIndices` marking each
  // hole's start in vertex count.
  const positions: number[] = [];
  const triangles: number[] = [];
  for (const g of groups) {
    const baseIdx = positions.length / 3;
    const flat2D: number[] = g.outer.loop2D.slice();
    const holeIndices: number[] = [];
    for (let i = 0; i < g.outer.loop3D.length; i++) positions.push(g.outer.loop3D[i]);
    let vertCursor = g.outer.loop2D.length / 2;
    for (const h of g.holes) {
      holeIndices.push(vertCursor);
      for (let i = 0; i < h.loop2D.length; i++) flat2D.push(h.loop2D[i]);
      for (let i = 0; i < h.loop3D.length; i++) positions.push(h.loop3D[i]);
      vertCursor += h.loop2D.length / 2;
    }
    const tris = earcut(flat2D, holeIndices.length > 0 ? holeIndices : undefined, 2);
    for (let i = 0; i < tris.length; i++) triangles.push(baseIdx + tris[i]);
  }
  if (triangles.length === 0) return null;

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(triangles),
  };
}

/**
 * One ring of a cap polygon — its tangent-space 2D coordinates,
 * the world-space 3D coordinates of the same vertices, and the
 * signed area used to classify the ring as outer (`> 0`, CCW)
 * or hole (`< 0`, CW).
 */
interface RingData {
  loop2D: number[];
  loop3D: number[];
  signedArea: number;
}

interface CapSegment {
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
}

/**
 * Extracts oriented line segments where each straddling triangle
 * crosses the plane.
 *
 * Three triangle categories contribute segments:
 *
 *   1. **Strictly straddling** (`hasPlus && hasMinus`): the
 *      triangle has at least one vertex on each side of the
 *      plane. One segment is emitted, running from the edge
 *      where the triangle's CCW boundary re-enters the kept
 *      half-space (`plus → minus` crossing) to the edge where
 *      it leaves (`minus → plus`).
 *   2. **Coplanar with outward normal aligned to `+dir`**: all
 *      three vertices on the plane and the triangle's outward
 *      face normal aligns with `+dir`. The triangle is the
 *      "top" of a kept-side solid that the plane grazes; the
 *      cap is the polygon outline of the coplanar patch. All
 *      three triangle edges are emitted in source CCW order;
 *      edges interior to the patch (shared with another
 *      coplanar triangle) emit twice in opposite directions
 *      and form degenerate 2-cycles that the stitcher filters
 *      out, leaving only the patch boundary.
 *   3. (Coplanar triangles whose outward normal aligns with
 *      `-dir` are silently skipped — they would belong to a
 *      solid sitting on the clipped side of the plane, where
 *      the source mesh is entirely removed by clipping and a
 *      free-floating cap would be misleading.)
 *
 * Combined with the source triangle's outward-facing CCW
 * winding, the emitted segments yield cap loops that wind
 * counter-clockwise when viewed from the clipped half-space
 * (camera at `+dir`), giving an emitted cap face normal of
 * `+dir`.
 *
 * Convention rationale: section planes cut the model so the
 * `+dir` half-space is hidden, leaving the user looking at the
 * cut from `+dir`. Aligning the cap face normal with `+dir`
 * makes the cap front-facing under default
 * `gl.frontFace(CCW)` / back-face culling, so it renders
 * without any cull-state changes on the cap material.
 */
function extractCapSegments(
  world: Float32Array,
  dist: Float32Array,
  indices: ArrayLike<number>,
  eps: MeshEpsilons,
  dir: Vec3,
): CapSegment[] {

  const segs: CapSegment[] = [];
  const verts = [0, 0, 0];
  const signs = [0, 0, 0];
  const dists = [0, 0, 0];
  const epsPlane = eps.plane;

  for (let i = 0; i < indices.length; i += 3) {
    verts[0] = indices[i];
    verts[1] = indices[i + 1];
    verts[2] = indices[i + 2];

    const d0 = dist[verts[0]], d1 = dist[verts[1]], d2 = dist[verts[2]];
    dists[0] = d0; dists[1] = d1; dists[2] = d2;

    signs[0] = d0 < -epsPlane ? -1 : (d0 > epsPlane ? 1 : 0);
    signs[1] = d1 < -epsPlane ? -1 : (d1 > epsPlane ? 1 : 0);
    signs[2] = d2 < -epsPlane ? -1 : (d2 > epsPlane ? 1 : 0);

    const hasPlus = signs[0] > 0 || signs[1] > 0 || signs[2] > 0;
    const hasMinus = signs[0] < 0 || signs[1] < 0 || signs[2] < 0;

    if (!hasPlus && !hasMinus) {
      // Coplanar triangle — all three verts within `epsPlane`
      // of the cut plane. Emit the triangle's three edges as
      // cap segments iff the outward face normal aligns with
      // `+dir` (the solid sits on the kept side and the plane
      // grazes its top). Triangles whose outward normal points
      // along `-dir` belong to clipped-side solids and would
      // float as orphan caps if emitted, so we skip them.
      const i0 = verts[0], i1 = verts[1], i2 = verts[2];
      const ax = world[i0 * 3],     ay = world[i0 * 3 + 1], az = world[i0 * 3 + 2];
      const bx = world[i1 * 3],     by = world[i1 * 3 + 1], bz = world[i1 * 3 + 2];
      const cx = world[i2 * 3],     cy = world[i2 * 3 + 1], cz = world[i2 * 3 + 2];
      const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
      const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
      const nx = e1y * e2z - e1z * e2y;
      const ny = e1z * e2x - e1x * e2z;
      const nz = e1x * e2y - e1y * e2x;
      const dotND = nx * dir[0] + ny * dir[1] + nz * dir[2];
      if (dotND <= 0) continue;
      // Emit edges in source CCW order. Internal edges shared
      // between two coplanar triangles will appear twice in
      // opposite directions; the stitcher's degenerate 2-cycle
      // is filtered out by the loop-length check, leaving only
      // patch-boundary edges.
      segs.push({ax,         ay,         az,         bx,         by,         bz});
      segs.push({ax: bx,     ay: by,     az: bz,     bx: cx,     by: cy,     bz: cz});
      segs.push({ax: cx,     ay: cy,     az: cz,     bx: ax,     by: ay,     bz: az});
      continue;
    }
    if (!(hasPlus && hasMinus)) continue;

    let entryX = 0, entryY = 0, entryZ = 0;
    let exitX = 0, exitY = 0, exitZ = 0;
    let haveEntry = false, haveExit = false;

    for (let e = 0; e < 3; e++) {
      const aIdx = verts[e];
      const bIdx = verts[(e + 1) % 3];
      const sa = signs[e];
      const sb = signs[(e + 1) % 3];
      const da = dists[e];
      const db = dists[(e + 1) % 3];

      if (sa < 0 && sb > 0) {
        const t = da / (da - db);
        exitX = world[aIdx * 3]     + t * (world[bIdx * 3]     - world[aIdx * 3]);
        exitY = world[aIdx * 3 + 1] + t * (world[bIdx * 3 + 1] - world[aIdx * 3 + 1]);
        exitZ = world[aIdx * 3 + 2] + t * (world[bIdx * 3 + 2] - world[aIdx * 3 + 2]);
        haveExit = true;
      } else if (sa > 0 && sb < 0) {
        const t = da / (da - db);
        entryX = world[aIdx * 3]     + t * (world[bIdx * 3]     - world[aIdx * 3]);
        entryY = world[aIdx * 3 + 1] + t * (world[bIdx * 3 + 1] - world[aIdx * 3 + 1]);
        entryZ = world[aIdx * 3 + 2] + t * (world[bIdx * 3 + 2] - world[aIdx * 3 + 2]);
        haveEntry = true;
      } else if (sa === 0 && sb !== 0) {
        const x = world[aIdx * 3], y = world[aIdx * 3 + 1], z = world[aIdx * 3 + 2];
        if (sb < 0) { entryX = x; entryY = y; entryZ = z; haveEntry = true; }
        else        { exitX = x;  exitY = y;  exitZ = z;  haveExit = true; }
      } else if (sb === 0 && sa !== 0) {
        const x = world[bIdx * 3], y = world[bIdx * 3 + 1], z = world[bIdx * 3 + 2];
        if (sa < 0) { exitX = x;  exitY = y;  exitZ = z;  haveExit = true; }
        else        { entryX = x; entryY = y; entryZ = z; haveEntry = true; }
      }
    }

    if (haveEntry && haveExit) {
      // Segment runs entry → exit (plus→minus crossing first,
      // then minus→plus). This convention produces cap loops
      // whose face normal is `+dir` — see the function-level
      // comment for the rationale.
      segs.push({
        ax: entryX, ay: entryY, az: entryZ,
        bx: exitX, by: exitY, bz: exitZ,
      });
    }
  }
  return segs;
}

/**
 * Stitches a segment soup into closed loops by joining segments
 * whose endpoints coincide within `eps.stitch`.
 *
 * Open polylines (incomplete chains from non-watertight meshes)
 * are dropped on the floor; the function returns only loops that
 * close back on their start. Each returned loop is a flat
 * `[x, y, z, x, y, z, ...]` array in winding order.
 */
function stitchSegmentsIntoLoops(
  segs: CapSegment[],
  eps: MeshEpsilons,
): number[][] {
  const inv = 1 / eps.stitch;
  const key = (x: number, y: number, z: number): string =>
    `${Math.round(x * inv)}|${Math.round(y * inv)}|${Math.round(z * inv)}`;

  const startsAt = new Map<string, number[]>();
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const k = key(s.ax, s.ay, s.az);
    const arr = startsAt.get(k);
    if (arr) arr.push(i); else startsAt.set(k, [i]);
  }

  const used = new Uint8Array(segs.length);
  const loops: number[][] = [];

  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    const loop: number[] = [];
    let cur = i;
    const startKey = key(segs[i].ax, segs[i].ay, segs[i].az);
    let safety = segs.length + 1;
    let closed = false;
    while (safety-- > 0) {
      if (used[cur]) break;
      used[cur] = 1;
      const s = segs[cur];
      loop.push(s.ax, s.ay, s.az);
      const tailKey = key(s.bx, s.by, s.bz);
      if (tailKey === startKey) { closed = true; break; }
      const candidates = startsAt.get(tailKey);
      if (!candidates) break;
      let next = -1;
      for (const c of candidates) {
        if (!used[c]) { next = c; break; }
      }
      if (next < 0) break;
      cur = next;
    }
    if (closed && loop.length >= 9) loops.push(loop);
  }
  return loops;
}

/**
 * Sutherland-Hodgman clip of a closed polygon against one
 * half-space, in 3D. The polygon's vertices must lie on a single
 * plane (the cap plane); clipping is performed by signed-distance
 * to {@link frame}.
 *
 * Kept side is `dot(dir, p) + dist <= 0`. Returns a new flat array
 * of `[x, y, z, ...]` for the clipped polygon (may be empty).
 */
function clipPolygonAgainstHalfSpace(
  loop: number[],
  frame: PlaneFrame,
  eps: MeshEpsilons,
): number[] {
  const n = loop.length / 3;
  if (n === 0) return loop;

  const out: number[] = [];
  const dirX = frame.dir[0], dirY = frame.dir[1], dirZ = frame.dir[2];
  const planeDist = frame.dist;
  const epsPlane = eps.plane;

  for (let i = 0; i < n; i++) {
    const curIdx = i;
    const prevIdx = (i - 1 + n) % n;

    const curX = loop[curIdx * 3], curY = loop[curIdx * 3 + 1], curZ = loop[curIdx * 3 + 2];
    const prevX = loop[prevIdx * 3], prevY = loop[prevIdx * 3 + 1], prevZ = loop[prevIdx * 3 + 2];

    const curD = dirX * curX + dirY * curY + dirZ * curZ + planeDist;
    const prevD = dirX * prevX + dirY * prevY + dirZ * prevZ + planeDist;

    const curIn = curD <= epsPlane;
    const prevIn = prevD <= epsPlane;

    if (curIn) {
      if (!prevIn) {
        const t = prevD / (prevD - curD);
        out.push(
          prevX + t * (curX - prevX),
          prevY + t * (curY - prevY),
          prevZ + t * (curZ - prevZ),
        );
      }
      out.push(curX, curY, curZ);
    } else if (prevIn) {
      const t = prevD / (prevD - curD);
      out.push(
        prevX + t * (curX - prevX),
        prevY + t * (curY - prevY),
        prevZ + t * (curZ - prevZ),
      );
    }
  }
  return out;
}
