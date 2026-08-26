/**
 * Geometry-only fallback {@link SpaceExtractor} — for SceneModels
 * without a paired DataModel. Emits a {@link SpaceGraph} of rooms
 * derived from a 2D occupancy-grid flood fill of the source
 * geometry. Doesn't synthesise portal edges; the
 * {@link TourPlanner} falls back to Euclidean teleport hops when
 * a tour spans rooms with no recognised connection.
 *
 * Algorithm:
 *  1. Read the scene's world AABB via the
 *     {@link spatial!collision.SceneCollisionIndex | SceneCollisionIndex}.
 *  2. Allocate a 2D occupancy grid in the horizontal plane
 *     (cell size = `options.wallClearance`).
 *  3. **Rasterise tall objects** — every SceneObject whose AABB
 *     vertical extent exceeds `WALL_HEIGHT_MIN` (1 m) gets its
 *     horizontal footprint stamped into the grid as occupied.
 *     Filters out floor slabs and ceilings without needing IFC
 *     type tags.
 *  4. **Flood-fill** the remaining free cells into connected
 *     components. Regions that touch the grid boundary are
 *     treated as "exterior" and discarded — otherwise the
 *     largest emitted room would always be "outside the
 *     building".
 *  5. Drop regions smaller than `MIN_ROOM_AREA` (4 m²) — these
 *     are gaps between adjacent wall AABBs, not real rooms.
 *  6. Emit one {@link SpaceGraphNode} per retained region, with
 *     world AABB lifted back from the cell extents and the
 *     model's vertical range.
 *
 * Limitations:
 *  - **Single-storey**. Multi-storey buildings collapse onto one
 *     horizontal plane, so rooms from different floors that
 *     happen to overlap in plan will merge. For multi-storey
 *     models supply a custom extractor or pre-filter the
 *     SceneModel to one storey at a time.
 *  - **No portal detection**. Doors aren't distinguishable from
 *     walls without semantics; the planner falls back to
 *     Euclidean teleports between rooms.
 *  - **AABB-granularity rasterisation**. Diagonal walls inflate
 *     to their axis-aligned bounding box, eating extra grid
 *     cells. Fine for orthogonal floor plans; introduces a small
 *     bias on rotated geometry.
 */
import {SDKErrorType, type SDKResult} from "@xeokit/sdk/base/core";
import type {AABB3} from "@xeokit/sdk/base/math/boundaries";
import type {Vec3} from "@xeokit/sdk/base/math/vector";
import {getSceneCollisionIndex} from "@xeokit/sdk/spatial/collision";

import type {SpaceExtractor, SpaceExtractorInput} from "./SpaceExtractor";
import type {SpaceGraph} from "../graph/SpaceGraph";
import type {SpaceGraphEdge} from "../graph/SpaceGraphEdge";
import type {SpaceGraphNode} from "../graph/SpaceGraphNode";
import {resolveUpAxis} from "../internal/cameraTourMath";


/** Minimum vertical extent (world units) for a SceneObject AABB
 *  to count as a "wall" candidate during rasterisation. Filters
 *  out floor slabs (typically < 0.5 m thick). */
const WALL_HEIGHT_MIN = 1.0;

/** Minimum room area (world-unit² = m² in metric scenes). Smaller
 *  flood regions are treated as wall-gap artefacts, not rooms. */
const MIN_ROOM_AREA = 4.0;

/** Memory budget for the occupancy grid, in cells (= bytes for the
 *  Uint8Array). 8M cells ≈ 8 MB allocation, covers a 2800×2800 grid
 *  at the default `wallClearance=0.4`. Exceeding the budget triggers
 *  an auto-coarsened cell size; without it, georeferenced or
 *  enormous-extent SceneModels would throw
 *  `RangeError: Array buffer allocation failed` at the Uint8Array
 *  allocation. */
const MAX_GRID_CELLS = 8_000_000;


export const extractSpacesFromGeometry: SpaceExtractor = {

  extract: async (input: SpaceExtractorInput): Promise<SDKResult<SpaceGraph>> => {

    const {sceneModel, options} = input;
    if (sceneModel.destroyed) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[extractSpacesFromGeometry] sceneModel is destroyed",
      };
    }
    options.onProgress?.("extract", 0);

    const collisionIndex = getSceneCollisionIndex(sceneModel.scene);
    const sceneAabb = collisionIndex.getSceneAABB();
    if (!sceneAabb) {
      return {ok: true, value: emptyGraph()};
    }
    const upAxis = resolveUpAxis(options.up ?? sceneModel.scene.coordinateSystem.worldUp);
    const horizAxes: [0 | 1 | 2, 0 | 1 | 2] = upAxis === 1 ? [0, 2] : [0, 1];
    const widthAxis = horizAxes[0];
    const depthAxis = horizAxes[1];

    const floor = sceneAabb[upAxis];
    const ceiling = sceneAabb[upAxis + 3];

    // ── Grid setup ───────────────────────────────────────────────
    const widthW = sceneAabb[widthAxis + 3] - sceneAabb[widthAxis];
    const depthW = sceneAabb[depthAxis + 3] - sceneAabb[depthAxis];
    if (!Number.isFinite(widthW) || !Number.isFinite(depthW) ||
        widthW <= 0 || depthW <= 0) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[extractSpacesFromGeometry] Scene AABB has non-finite or ` +
               `zero horizontal extent (widthW=${widthW}, depthW=${depthW}) — ` +
               `nothing to rasterise.`,
      };
    }
    // Auto-adjust cell size so the grid stays within a memory budget.
    // Big or georeferenced models could otherwise demand a multi-
    // gigabyte Uint8Array and throw `RangeError: Array buffer
    // allocation failed` here. The cap (~8M cells) lets a square
    // ~2800×2800 grid land at the requested cell size before we
    // start coarsening; beyond that, we round cell size up until
    // gw*gd fits.
    const requested = Math.max(0.1, options.wallClearance);
    let cellSize = requested;
    let gw = Math.max(1, Math.ceil(widthW / cellSize));
    let gd = Math.max(1, Math.ceil(depthW / cellSize));
    if (gw * gd > MAX_GRID_CELLS) {
      // Cells scale as 1/cellSize per axis → grid cells scale as
      // 1/cellSize². Pick cellSize so area*1/cellSize² == MAX.
      const area = widthW * depthW;
      cellSize = Math.sqrt(area / MAX_GRID_CELLS);
      gw = Math.max(1, Math.ceil(widthW / cellSize));
      gd = Math.max(1, Math.ceil(depthW / cellSize));
      console.warn(
        `[extractSpacesFromGeometry] Scene horizontal extent ` +
        `${widthW.toFixed(1)}×${depthW.toFixed(1)} world units would need a ` +
        `${Math.ceil(widthW / requested)}×${Math.ceil(depthW / requested)} grid at the ` +
        `requested cellSize=${requested}; coarsened to ` +
        `${gw}×${gd} at cellSize=${cellSize.toFixed(3)} to keep memory bounded. ` +
        `Tighten the search by passing a pre-clipped SceneModel or a custom extractor.`,
      );
    }
    const grid = new Uint8Array(gw * gd);   // 0 = free, 1 = occupied

    // ── Rasterise tall objects (walls / columns) ─────────────────
    const objectIds = Object.keys(sceneModel.objects);
    for (const objId of objectIds) {
      const aabb = collisionIndex.getObjectAABB(objId);
      if (!aabb) continue;
      const height = aabb[upAxis + 3] - aabb[upAxis];
      if (height < WALL_HEIGHT_MIN) continue;

      const ix0 = clamp(Math.floor((aabb[widthAxis] - sceneAabb[widthAxis]) / cellSize), 0, gw);
      const ix1 = clamp(Math.ceil((aabb[widthAxis + 3] - sceneAabb[widthAxis]) / cellSize), 0, gw);
      const iz0 = clamp(Math.floor((aabb[depthAxis] - sceneAabb[depthAxis]) / cellSize), 0, gd);
      const iz1 = clamp(Math.ceil((aabb[depthAxis + 3] - sceneAabb[depthAxis]) / cellSize), 0, gd);
      for (let z = iz0; z < iz1; z++) {
        const row = z * gw;
        for (let x = ix0; x < ix1; x++) {
          grid[row + x] = 1;
        }
      }
    }
    options.onProgress?.("extract", 0.6);

    // ── Flood-fill free cells into rooms ─────────────────────────
    // `regionId`: 0 = wall or unassigned, 1+ = room id.
    const regionId = new Int32Array(gw * gd);
    const regions: Array<{
      id: number;
      cellCount: number;
      xMin: number; xMax: number;
      zMin: number; zMax: number;
      touchesEdge: boolean;
    }> = [];

    // BFS queues — reused across regions to avoid per-region allocations.
    const queueX: number[] = [];
    const queueZ: number[] = [];
    let nextRegionId = 0;

    for (let z = 0; z < gd; z++) {
      for (let x = 0; x < gw; x++) {
        const idx = z * gw + x;
        if (grid[idx] !== 0 || regionId[idx] !== 0) continue;

        nextRegionId++;
        const r = {
          id: nextRegionId,
          cellCount: 0,
          xMin: x, xMax: x,
          zMin: z, zMax: z,
          touchesEdge: false,
        };
        queueX.length = 0;
        queueZ.length = 0;
        queueX.push(x); queueZ.push(z);
        let head = 0;
        regionId[idx] = nextRegionId;

        while (head < queueX.length) {
          const cx = queueX[head];
          const cz = queueZ[head];
          head++;
          r.cellCount++;
          if (cx < r.xMin) r.xMin = cx;
          if (cx > r.xMax) r.xMax = cx;
          if (cz < r.zMin) r.zMin = cz;
          if (cz > r.zMax) r.zMax = cz;
          if (cx === 0 || cx === gw - 1 || cz === 0 || cz === gd - 1) {
            r.touchesEdge = true;
          }
          // 4-connected neighbours.
          if (cx > 0)        tryEnqueue(cx - 1, cz);
          if (cx < gw - 1)   tryEnqueue(cx + 1, cz);
          if (cz > 0)        tryEnqueue(cx,     cz - 1);
          if (cz < gd - 1)   tryEnqueue(cx,     cz + 1);
        }
        regions.push(r);

        function tryEnqueue(nx: number, nz: number): void {
          const nIdx = nz * gw + nx;
          if (grid[nIdx] !== 0 || regionId[nIdx] !== 0) return;
          regionId[nIdx] = nextRegionId;
          queueX.push(nx); queueZ.push(nz);
        }
      }
    }
    options.onProgress?.("extract", 0.9);

    // ── Build nodes from valid regions ───────────────────────────
    const minCells = Math.max(4, Math.ceil(MIN_ROOM_AREA / (cellSize * cellSize)));
    const nodes: SpaceGraphNode[] = [];
    const nodesById = new Map<string, SpaceGraphNode>();
    const noEdges: ReadonlyArray<SpaceGraphEdge> = [];

    for (const r of regions) {
      // Exterior region (touches the grid boundary) — by
      // construction, the largest such region is "outside the
      // building". Drop them all rather than try to distinguish
      // exterior from edge-clipped rooms; the bias is acceptable
      // for the fallback path.
      if (r.touchesEdge) continue;
      if (r.cellCount < minCells) continue;

      const wMin = sceneAabb[widthAxis] + r.xMin * cellSize;
      const wMax = sceneAabb[widthAxis] + (r.xMax + 1) * cellSize;
      const dMin = sceneAabb[depthAxis] + r.zMin * cellSize;
      const dMax = sceneAabb[depthAxis] + (r.zMax + 1) * cellSize;

      const aabb = new Float64Array(6);
      aabb[widthAxis]     = wMin;
      aabb[depthAxis]     = dMin;
      aabb[upAxis]        = floor;
      aabb[widthAxis + 3] = wMax;
      aabb[depthAxis + 3] = dMax;
      aabb[upAxis + 3]    = ceiling;

      const centroid: Vec3 = [
        (aabb[0] + aabb[3]) * 0.5,
        (aabb[1] + aabb[4]) * 0.5,
        (aabb[2] + aabb[5]) * 0.5,
      ] as Vec3;

      const id = `room-${r.id}`;
      const node: SpaceGraphNode = {
        id,
        aabb: aabb as unknown as AABB3,
        centroid,
        floorElevation: floor,
        label: `Room ${r.id}`,
        edges: noEdges,
      };
      nodes.push(node);
      nodesById.set(id, node);
    }
    options.onProgress?.("extract", 1);

    return {
      ok: true,
      value: {nodes, edges: [], nodesById},
    };
  },
};


// ─── Helpers ─────────────────────────────────────────────────────

function emptyGraph(): SpaceGraph {
  return {nodes: [], edges: [], nodesById: new Map()};
}

function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}
