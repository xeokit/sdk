import type {CameraTourWaypoint} from "../plan/CameraTourWaypoint";


/**
 * Output of {@link buildTourWaypoints}.
 *
 * @internal
 */
export interface BuildTourWaypointsResult {
  waypoints: ReadonlyArray<CameraTourWaypoint>;
  /** Sum of all dwellMs + flightDurationMs across consecutive waypoints. */
  estimatedDurationMs: number;
}
