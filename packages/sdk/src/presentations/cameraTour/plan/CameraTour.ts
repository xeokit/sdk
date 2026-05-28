import type {CameraTourWaypoint} from "./CameraTourWaypoint";
import type {SpaceGraph} from "../graph/SpaceGraph";


/**
 * Resolved walkthrough plan returned by {@link planCameraTour}.
 *
 * Pure data — no methods, no lifecycle. Driving the tour against
 * a `View` is the job of the separate `playCameraTour` helper,
 * which feeds these waypoints into the existing
 * {@link viewing!cameraFlight.CameraPath | CameraPath} +
 * {@link viewing!cameraFlight.CameraPathAnimation | CameraPathAnimation}
 * playback infrastructure.
 *
 * The included {@link spaceGraph} is the same graph the planner
 * operated on, surfaced here so callers can render an overview
 * map / minimap, or pre-load assets for upcoming rooms.
 */
export interface CameraTour {

  /**
   * Ordered list of waypoints to visit. Includes both in-space
   * stops and any portal-transit waypoints inserted by the
   * smoother. Always non-empty when {@link planCameraTour}
   * succeeds.
   */
  waypoints: ReadonlyArray<CameraTourWaypoint>;

  /**
   * The space graph the tour was planned over, returned for
   * inspection / overview rendering. Same instance the active
   * {@link TourPlanner} consumed.
   */
  spaceGraph: SpaceGraph;

  /**
   * Estimated total playback duration in milliseconds — sum of
   * per-waypoint dwell times plus inter-waypoint flight times
   * (using {@link CameraTourPlanOptions.flightDurationMs} as the
   * default flight estimate). Independent of any later
   * playback-speed overrides.
   */
  estimatedDurationMs: number;
}
