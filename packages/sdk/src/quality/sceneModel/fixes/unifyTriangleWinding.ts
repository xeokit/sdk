import type {SceneModel} from "../../../model/scene";
import {SDKErrorType, type SDKResult} from "../../../base/core";
import {SolidPrimitive, SurfacePrimitive, TrianglesPrimitive} from "../../../base/constants";
import type {Fix, FixApplyResult} from "../Fix";
import {finishGeometryMutation, snapshotGeometryMutation} from "../internal/finishGeometryMutation";
import {getInspectionIndex} from "../internal/getInspectionIndex";
import type {Issue} from "../Issue";


/**
 * Auto-fix for `GEOMETRY_INCONSISTENT_WINDING` — flood-fills
 * triangle winding from a seed, flipping every triangle whose
 * shared edge runs the same direction as its source neighbour
 * (i.e. winds the wrong way relative to the seed).
 *
 * Algorithm:
 *
 *   1. Build an undirected-edge → adjacent-triangle map.
 *   2. Pick triangle 0 as the seed (assumed correct winding).
 *   3. DFS through neighbours: for each unvisited triangle that
 *      shares an edge with the current one, look at the post-flip
 *      directed edges of both. If they traverse the shared edge
 *      in the *same* direction, mark the neighbour as needing a
 *      flip.
 *   4. Repeat from each unvisited triangle to handle disconnected
 *      components.
 *   5. Rewrite `geom.indices`: triangles flagged for flip get
 *      their last two indices swapped (`i0,i1,i2` → `i0,i2,i1`).
 *
 * Vertex normals don't need updating — smooth normals are
 * direction-independent of the per-triangle winding that produced
 * them. `edgeIndices` is undirected, also untouched.
 *
 * **Caveat — seed selection.** If more than half of the original
 * triangles were wound wrong, the seed is one of those wrong
 * triangles, and the fix flips the *correct* half to match. The
 * resulting mesh is consistently wound but inside-out. Re-run the
 * inspection: `GEOMETRY_INCONSISTENT_WINDING` will be silent
 * (consistent) but visual inspection will show the model rendering
 * back-faces. In that case the user can apply the fix again with
 * the index ordering reversed (manual triage) or re-author the
 * model upstream.
 *
 * Idempotent: returns `{fixed: false}` on a non-triangle
 * primitive, missing indices, or a mesh that already has every
 * directed edge unique.
 */
export const unifyTriangleWinding: Fix = {

  codes: ["GEOMETRY_INCONSISTENT_WINDING"],

  description: "Unify triangle winding",

  procedure: [
    "Map each edge to the triangles that share it",
    "Pick the first triangle as the reference (assumed correctly wound)",
    "Walk neighbouring triangles; flip any wound the wrong way relative to the reference",
    "Repeat for any disconnected pieces of the mesh",
    "Write out the new triangle list with flipped triangles reversed",
  ],

  config: {
    enabled: {
      kind: "boolean",
      key: "enableUnifyTriangleWinding",
      label: "Unify triangle winding",
      default: true,
    },
  },

  apply(issue: Issue, sceneModel: SceneModel): SDKResult<FixApplyResult> {
    const geomId = issue.resourceId;
    if (!geomId) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[unifyTriangleWinding] issue has no resourceId (geometry id)`,
      };
    }
    const geom = sceneModel.geometries[geomId];
    if (!geom || geom.destroyed) return {ok: true, value: {fixed: false, reason: "target-missing"}};
    if (!geom.indices) return {ok: true, value: {fixed: false, reason: "malformed-issue"}};
    const isTri =
      geom.primitive === TrianglesPrimitive ||
      geom.primitive === SolidPrimitive ||
      geom.primitive === SurfacePrimitive;
    if (!isTri) return {ok: true, value: {fixed: false, reason: "precondition-failed"}};

    const indices = geom.indices;
    const triCount = (indices.length / 3) | 0;
    if (triCount === 0) return {ok: true, value: {fixed: false, reason: "no-op"}};

    // ── Edge → triangle adjacency ───────────────────────────
    // From the shared inspection index — `edges` is the per-
    // undirected-edge triangle list, `degenerate[t] === 1` iff
    // triangle `t` has repeated indices and is excluded from
    // adjacency.
    const adj = getInspectionIndex(sceneModel).edgeToTriangles(geomId);
    if (!adj) return {ok: true, value: {fixed: false, reason: "precondition-failed"}};
    const edgeToTris = adj.edges;
    const isDegenerate = adj.degenerate;

    // ── Flood-fill ──────────────────────────────────────────
    // visited / flipped are parallel bitmaps over triangle ids.
    // The DFS stack holds triangle ids. For each pop, look at the
    // triangle's post-flip directed edges and check each
    // unvisited adjacent triangle: if its post-flip edge runs in
    // the same direction as the source, it needs flipping.
    const visited = new Uint8Array(triCount);
    const flipped = new Uint8Array(triCount);
    const stack: number[] = [];
    let anyFlipped = false;

    for (let seed = 0; seed < triCount; seed++) {
      if (visited[seed] || isDegenerate[seed]) continue;
      visited[seed] = 1;
      stack.push(seed);
      while (stack.length > 0) {
        const t = stack.pop() as number;
        // Post-flip indices of t.
        const a0 = indices[t * 3];
        const a1 = flipped[t] ? indices[t * 3 + 2] : indices[t * 3 + 1];
        const a2 = flipped[t] ? indices[t * 3 + 1] : indices[t * 3 + 2];

        for (let e = 0; e < 3; e++) {
          const u = e === 0 ? a0 : (e === 1 ? a1 : a2);
          const v = e === 0 ? a1 : (e === 1 ? a2 : a0);
          const lo = u < v ? u : v;
          const hi = u < v ? v : u;
          const k = `${lo}_${hi}`;
          const bucket = edgeToTris.get(k);
          if (!bucket) continue;
          for (let bi = 0; bi < bucket.length; bi++) {
            const n = bucket[bi];
            if (n === t || visited[n]) continue;

            // Check whether n's post-flip indices contain the
            // *same-direction* directed edge (u → v). If yes,
            // flipping n is required to make their shared edge
            // run in opposite directions.
            const n0 = indices[n * 3];
            const n1 = flipped[n] ? indices[n * 3 + 2] : indices[n * 3 + 1];
            const n2 = flipped[n] ? indices[n * 3 + 1] : indices[n * 3 + 2];
            const sameDir =
              (n0 === u && n1 === v) ||
              (n1 === u && n2 === v) ||
              (n2 === u && n0 === v);
            if (sameDir) {
              flipped[n] = 1;
              anyFlipped = true;
            }
            visited[n] = 1;
            stack.push(n);
          }
        }
      }
    }

    if (!anyFlipped) return {ok: true, value: {fixed: false, reason: "no-op"}};

    // Materialise the new indices array. Flipped triangles get
    // their last two indices swapped (i0, i1, i2 → i0, i2, i1).
    let flippedCount = 0;
    const out = new Uint32Array(indices.length);
    for (let t = 0; t < triCount; t++) {
      const o = t * 3;
      if (flipped[t]) {
        out[o]     = indices[o];
        out[o + 1] = indices[o + 2];
        out[o + 2] = indices[o + 1];
        flippedCount++;
      } else {
        out[o]     = indices[o];
        out[o + 1] = indices[o + 1];
        out[o + 2] = indices[o + 2];
      }
    }
    const before = snapshotGeometryMutation(geom);
    (geom as { indices: typeof out }).indices = out;
    finishGeometryMutation(geom, before);
    return {ok: true, value: {fixed: true, trace: `'${geomId}': flipped ${flippedCount.toLocaleString()} of ${triCount.toLocaleString()} triangles`}};
  },
};
