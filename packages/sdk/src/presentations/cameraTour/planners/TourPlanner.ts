import type {SDKResult} from "../../../base/core";

import type {CameraTourPlanOptions} from "../plan/CameraTourPlanOptions";
import type {SpaceGraph} from "../graph/SpaceGraph";
import type {ViewpointGraph} from "../graph/ViewpointGraph";


/**
 * Inputs handed to {@link TourPlanner.plan}.
 */
export interface TourPlannerInput {
  spaceGraph: SpaceGraph;
  viewpointGraph: ViewpointGraph;
  options: Required<Omit<CameraTourPlanOptions, "onProgress" | "up" | "startSpaceId">> &
           Pick<CameraTourPlanOptions, "onProgress" | "up" | "startSpaceId">;
}


/**
 * One stop on the planned tour — a `(space, chosen viewpoint)`
 * pair the smoother will turn into a {@link CameraTourWaypoint}.
 */
export interface TourStop {
  spaceNodeId: string;
  viewpointNodeId: string;
}


/**
 * Output of {@link TourPlanner.plan} — the ordered sequence of
 * stops the smoother turns into the final waypoint list.
 */
export interface TourPlanResult {
  stops: ReadonlyArray<TourStop>;
}


/**
 * Stage 3 of the {@link planCameraTour} pipeline — pick the
 * order of spaces to visit and the chosen viewpoint per stop.
 *
 * The default planner is `planTourTwoOpt` — it seeds with the
 * greedy nearest-neighbour walk from
 * {@link CameraTourPlanOptions.startSpaceId} (or the largest
 * space when no start hint is given), selects each space's
 * highest-scoring viewpoint, then runs 2-opt swaps until the
 * tour is a local optimum. `planTourGreedy` is the unrefined
 * seed, exposed so latency-sensitive callers can skip the
 * refinement pass.
 *
 * Implementations should:
 *  - visit every space that has at least one viewpoint;
 *  - skip spaces whose viewpoint bucket is empty;
 *  - prefer adjacent-via-portal hops over teleporting across
 *    the building, even when a teleport would be shorter
 *    Euclidean distance.
 */
export interface TourPlanner {
  plan(input: TourPlannerInput): Promise<SDKResult<TourPlanResult>>;
}
