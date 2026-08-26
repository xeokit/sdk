/**
 * 2-opt refinement {@link TourPlanner} — drop-in upgrade for
 * {@link planTourGreedy} when greedy nearest-neighbour produces
 * a hairpin tour on a large or convoluted floor plan.
 *
 * Algorithm:
 *  1. Seed with the greedy tour as a starting point.
 *  2. Repeatedly scan every pair of non-adjacent edges
 *     `(t_i → t_{i+1}, t_j → t_{j+1})` looking for a 2-opt swap
 *     that reduces total tour length:
 *
 *         remove   t_i → t_{i+1}   and   t_j → t_{j+1}
 *         add      t_i → t_j       and   t_{i+1} → t_{j+1}
 *
 *     Achieved in place by reversing the segment
 *     `tour[i+1 .. j]`.
 *  3. Repeat until a full pass yields no improvement (local
 *     optimum) or a safety cap on total swaps is hit.
 *
 * Distance metric is Euclidean between viewpoint positions, with
 * a 0.5× discount on **portal-adjacent** hops so the optimiser
 * keeps the greedy planner's bias toward door-walking transitions
 * over teleports. The optimiser produces a strictly-no-worse tour
 * than greedy (2-opt is monotonically improving), but is **not**
 * a globally optimal TSP solver — for that swap in a third-party
 * solver.
 *
 * Complexity: O(swaps × n²). For typical AECO scenes (10–100
 * rooms) the loop converges in a handful of passes, ~ms total.
 * Yields to the host every 64 accepted swaps so large floor
 * plans don't block the main thread.
 */
import {type SDKResult} from "@xeokit/sdk/base/core";
import type {SpaceGraph} from "../graph/SpaceGraph";
import type {ViewpointGraph} from "../graph/ViewpointGraph";
import type {ViewpointGraphNode} from "../graph/ViewpointGraphNode";

import {planTourGreedy} from "./planTourGreedy";
import type {TourPlanner, TourPlannerInput, TourPlanResult, TourStop} from "./TourPlanner";


/** Distance discount applied to portal-adjacent hops. < 1 biases
 *  the optimiser toward keeping door-walks; 1.0 = treat portal
 *  and teleport hops the same; > 1 actively prefers teleports
 *  (don't do that). */
const PORTAL_DISCOUNT = 0.5;


export const planTourTwoOpt: TourPlanner = {

  plan: async (input: TourPlannerInput): Promise<SDKResult<TourPlanResult>> => {

    // ── Seed with the greedy tour ─────────────────────────────────
    const greedyRes = await planTourGreedy.plan(input);
    if (greedyRes.ok === false) return greedyRes;

    const tour: TourStop[] = [...greedyRes.value.stops];
    // 2-opt needs at least 4 nodes to find two non-adjacent edges
    // in an open tour — anything smaller can't be improved.
    if (tour.length < 4) {
      input.options.onProgress?.("plan", 1);
      return {ok: true, value: {stops: tour}};
    }

    const dist = makeDistanceFunction(input.spaceGraph, input.viewpointGraph);

    // Safety cap — 2-opt is monotonically improving so it converges,
    // but FP drift could in principle cause oscillation. Bound the
    // total accepted swaps at n² to absolutely guarantee termination.
    const MAX_SWAPS = tour.length * tour.length;
    let totalSwaps = 0;
    let improvedThisPass = true;
    let pass = 0;

    while (improvedThisPass && totalSwaps < MAX_SWAPS) {
      improvedThisPass = false;
      pass++;

      // Open-tour 2-opt: edges are (t_i, t_{i+1}) for i in [0, n-2]
      // and edges (t_j, t_{j+1}) for j in [i+2, n-2] — non-adjacent
      // pairs only. j = n-1 would leave a half-edge at the tail.
      for (let i = 0; i < tour.length - 2; i++) {
        for (let j = i + 2; j < tour.length - 1; j++) {
          const a = tour[i];
          const b = tour[i + 1];
          const c = tour[j];
          const d = tour[j + 1];

          const before = dist(a, b) + dist(c, d);
          const after  = dist(a, c) + dist(b, d);

          // Epsilon guards against FP noise re-accepting near-zero
          // "improvements" forever.
          if (after < before - 1e-9) {
            reverseRange(tour, i + 1, j);
            improvedThisPass = true;
            totalSwaps++;
            if (totalSwaps >= MAX_SWAPS) break;
            if ((totalSwaps & 63) === 0) await yieldToHost();
          }
        }
        if (totalSwaps >= MAX_SWAPS) break;
      }
      // Progress is approximate — we have no a priori upper bound
      // on how many passes converge takes. Report passes processed
      // up to a soft ceiling of 8, then sit at 0.95 until done.
      input.options.onProgress?.("plan", Math.min(0.95, pass / 8));
    }

    input.options.onProgress?.("plan", 1);
    return {ok: true, value: {stops: tour}};
  },
};


// ─── Distance function ──────────────────────────────────────────

/**
 * Build a per-pair distance closure: Euclidean between the chosen
 * viewpoints' positions, with a {@link PORTAL_DISCOUNT} multiplier
 * for portal-adjacent space pairs.
 */
function makeDistanceFunction(
    spaceGraph: SpaceGraph,
    viewpointGraph: ViewpointGraph,
): (a: TourStop, b: TourStop) => number {

  const vpById = new Map<string, ViewpointGraphNode>();
  for (const vp of viewpointGraph.nodes) vpById.set(vp.id, vp);

  // Portal adjacency as Set<otherSpaceId> per space — O(1) lookup
  // during the 2-opt inner loop.
  const adjacency = new Map<string, Set<string>>();
  for (const space of spaceGraph.nodes) {
    const adj = new Set<string>();
    for (const edge of space.edges) {
      adj.add(edge.from === space.id ? edge.to : edge.from);
    }
    adjacency.set(space.id, adj);
  }

  return (a: TourStop, b: TourStop): number => {
    if (a.spaceNodeId === b.spaceNodeId) return 0;
    const vpA = vpById.get(a.viewpointNodeId);
    const vpB = vpById.get(b.viewpointNodeId);
    if (!vpA || !vpB) return Infinity;   // defensive — planner produced an unknown id
    const dx = vpA.position[0] - vpB.position[0];
    const dy = vpA.position[1] - vpB.position[1];
    const dz = vpA.position[2] - vpB.position[2];
    const eucl = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const portal = adjacency.get(a.spaceNodeId)?.has(b.spaceNodeId) === true;
    return portal ? eucl * PORTAL_DISCOUNT : eucl;
  };
}


// ─── In-place segment reverse ───────────────────────────────────

function reverseRange<T>(arr: T[], lo: number, hi: number): void {
  while (lo < hi) {
    const tmp = arr[lo];
    arr[lo] = arr[hi];
    arr[hi] = tmp;
    lo++;
    hi--;
  }
}


// ─── Cooperative yield ──────────────────────────────────────────

function yieldToHost(): Promise<void> {
  if (typeof requestAnimationFrame === "function") {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}
