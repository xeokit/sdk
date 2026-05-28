import type {CameraTourPlanOptions} from "../plan/CameraTourPlanOptions";
import type {SpaceGraph} from "../graph/SpaceGraph";
import type {ViewpointGraph} from "../graph/ViewpointGraph";
import type {TourStop} from "../planners/TourPlanner";


/**
 * Inputs to {@link buildTourWaypoints}.
 *
 * @internal
 */
export interface BuildTourWaypointsInput {
  stops: ReadonlyArray<TourStop>;
  spaceGraph: SpaceGraph;
  viewpointGraph: ViewpointGraph;
  /** Resolved options — every field used here is required. */
  options: Required<Pick<CameraTourPlanOptions,
      "eyeHeight" | "dwellMs" | "flightDurationMs">>;
  /** World up — looked up from the source scene when not overridden. */
  up: [number, number, number];
}
