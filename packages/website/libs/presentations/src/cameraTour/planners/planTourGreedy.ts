/**
 * Default {@link TourPlanner}. Greedy nearest-neighbour traversal
 * over the {@link SpaceGraph}.
 *
 * Algorithm:
 *  1. **Pick start space** — `options.startSpaceId` (matched against
 *     {@link SpaceGraphNode.id}, then `sceneObjectId`, then
 *     `dataObjectId`) when supplied; otherwise the largest-AABB
 *     space, tiebroken by lowest floor.
 *  2. **Walk** — from the current space, the next stop is the
 *     **portal-adjacent unvisited space** whose centroid is
 *     closest. When no portal-adjacent unvisited space remains
 *     (dead end or disconnected component), teleport to the
 *     globally nearest unvisited space — the smoother turns these
 *     non-portal hops into long-flight transits rather than
 *     portal walks.
 *  3. **Per-stop viewpoint** — each emitted stop pairs the space
 *     with its highest-scoring {@link ViewpointGraphNode}.
 *  4. **Skip empty spaces** — spaces whose viewpoint bucket is
 *     empty (sampler couldn't place a clearance-respecting
 *     camera) are filtered out of the search domain entirely.
 *
 * Greedy NN with preference for adjacency is good enough for
 * typical AECO floor plans (10–100 rooms); for larger or more
 * convoluted layouts where the greedy tour hairpins, swap in the
 * `planTourTwoOpt` planner.
 */
import {SDKErrorType, type SDKResult} from "@xeokit/sdk/base/core";

import type {SpaceGraph} from "../graph/SpaceGraph";
import type {SpaceGraphNode} from "../graph/SpaceGraphNode";
import type {ViewpointGraph} from "../graph/ViewpointGraph";
import type {ViewpointGraphNode} from "../graph/ViewpointGraphNode";
import type {TourPlanner, TourPlannerInput, TourPlanResult, TourStop} from "./TourPlanner";
import {squaredDist} from "../internal/cameraTourMath";


export const planTourGreedy: TourPlanner = {

  plan: async (input: TourPlannerInput): Promise<SDKResult<TourPlanResult>> => {

    const {spaceGraph, viewpointGraph, options} = input;

    // Restrict the search to spaces that actually have a viewpoint
    // the smoother can place a camera at. Spaces with empty buckets
    // are unreachable as tour stops by contract.
    const domain = new Set<string>();
    for (const space of spaceGraph.nodes) {
      const bucket = viewpointGraph.nodesBySpaceId.get(space.id);
      if (bucket && bucket.length > 0) domain.add(space.id);
    }
    if (domain.size === 0) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[planTourGreedy] No spaces have viewpoints — sampler returned " +
               "empty buckets for every space. Lower `wallClearance` or raise " +
               "`maxViewpointsPerRoom` and retry.",
      };
    }

    // Resolve the start space — caller hint first, then the
    // largest-AABB ground-floor space as the natural "front-door"
    // tour kickoff.
    const start = pickStartSpace(spaceGraph, domain, options.startSpaceId);
    if (!start) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[planTourGreedy] startSpaceId '${options.startSpaceId}' ` +
               `not found in space graph (or has no viewpoints).`,
      };
    }

    const stops: TourStop[] = [];
    const visited = new Set<string>();

    let current: SpaceGraphNode = start;
    visited.add(current.id);
    stops.push(emitStop(current, viewpointGraph));

    let stepCount = 0;
    const totalSteps = Math.max(1, domain.size - 1);

    while (visited.size < domain.size) {
      // 1) Prefer a portal-adjacent unvisited space.
      let next: SpaceGraphNode | null = nearestAdjacentUnvisited(
          current, spaceGraph, domain, visited);
      // 2) Fallback: teleport to the globally nearest unvisited
      //    space (Euclidean centroid distance). Smoother flags
      //    these legs so playback uses a longer transit duration.
      if (!next) {
        next = nearestUnvisited(current, spaceGraph, domain, visited);
      }
      if (!next) break;   // defensive — domain set should have caught this

      visited.add(next.id);
      stops.push(emitStop(next, viewpointGraph));
      current = next;

      stepCount++;
      options.onProgress?.("plan", stepCount / totalSteps);
    }

    options.onProgress?.("plan", 1);
    return {ok: true, value: {stops}};
  },
};


// ─── Start-space selection ──────────────────────────────────────

function pickStartSpace(
    graph: SpaceGraph,
    domain: Set<string>,
    hint: string | undefined,
): SpaceGraphNode | null {
  if (hint) {
    // Try the hint against id, sceneObjectId, dataObjectId in turn.
    const exact = graph.nodesById.get(hint);
    if (exact && domain.has(exact.id)) return exact;
    for (const node of graph.nodes) {
      if (!domain.has(node.id)) continue;
      if (node.sceneObjectId === hint || node.dataObjectId === hint) return node;
    }
    return null;   // hint was supplied but didn't resolve
  }
  // No hint — pick the largest-volume space, tiebroken by lowest
  // floor (so multi-storey buildings start at the ground floor).
  let best: SpaceGraphNode | null = null;
  let bestVol = -Infinity;
  let bestFloor = Infinity;
  for (const node of graph.nodes) {
    if (!domain.has(node.id)) continue;
    const vol = aabbVolume(node.aabb as unknown as ArrayLike<number>);
    if (vol > bestVol || (vol === bestVol && node.floorElevation < bestFloor)) {
      best = node;
      bestVol = vol;
      bestFloor = node.floorElevation;
    }
  }
  return best;
}


// ─── Adjacency / nearest-unvisited search ───────────────────────

function nearestAdjacentUnvisited(
    current: SpaceGraphNode,
    graph: SpaceGraph,
    domain: Set<string>,
    visited: Set<string>,
): SpaceGraphNode | null {
  let best: SpaceGraphNode | null = null;
  let bestD2 = Infinity;
  for (const edge of current.edges) {
    const otherId = edge.from === current.id ? edge.to : edge.from;
    if (visited.has(otherId) || !domain.has(otherId)) continue;
    const other = graph.nodesById.get(otherId);
    if (!other) continue;
    const d2 = squaredDist(current.centroid as ArrayLike<number>, other.centroid as ArrayLike<number>);
    if (d2 < bestD2) { bestD2 = d2; best = other; }
  }
  return best;
}

function nearestUnvisited(
    current: SpaceGraphNode,
    graph: SpaceGraph,
    domain: Set<string>,
    visited: Set<string>,
): SpaceGraphNode | null {
  let best: SpaceGraphNode | null = null;
  let bestD2 = Infinity;
  for (const node of graph.nodes) {
    if (visited.has(node.id) || !domain.has(node.id)) continue;
    const d2 = squaredDist(current.centroid as ArrayLike<number>, node.centroid as ArrayLike<number>);
    if (d2 < bestD2) { bestD2 = d2; best = node; }
  }
  return best;
}


// ─── Per-stop viewpoint selection ───────────────────────────────

function emitStop(
    space: SpaceGraphNode,
    viewpointGraph: ViewpointGraph,
): TourStop {
  const bucket = viewpointGraph.nodesBySpaceId.get(space.id);
  // Callers have already filtered for non-empty buckets via
  // `domain`, so `bucket!` is safe here.
  const best = bestViewpoint(bucket!);
  return {spaceNodeId: space.id, viewpointNodeId: best.id};
}

function bestViewpoint(bucket: ReadonlyArray<ViewpointGraphNode>): ViewpointGraphNode {
  // The default sampler emits viewpoints already sorted by score
  // descending, but a custom sampler isn't required to — pick max
  // explicitly so the planner stays robust to ordering choices.
  let best = bucket[0];
  for (let i = 1; i < bucket.length; i++) {
    if (bucket[i].score > best.score) best = bucket[i];
  }
  return best;
}


// ─── Small math ─────────────────────────────────────────────────

function aabbVolume(aabb: ArrayLike<number>): number {
  return Math.max(0, aabb[3] - aabb[0]) *
         Math.max(0, aabb[4] - aabb[1]) *
         Math.max(0, aabb[5] - aabb[2]);
}
