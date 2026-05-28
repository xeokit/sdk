import type {CameraTourWaypoint} from "../plan/CameraTourWaypoint";


/**
 * Optional playback knobs for {@link playCameraTour}.
 */
export interface PlayCameraTourOptions {

  /**
   * Playback rate multiplier. `2.0` plays at double speed,
   * `0.5` at half speed. Default `1.0`.
   */
  rate?: number;

  /**
   * Per-leg transit duration in ms. Overrides the value
   * {@link planCameraTour} used to estimate the tour duration.
   * Default: `1500`.
   */
  flightDurationMs?: number;

  /**
   * Waypoint index the tour starts at. Default `0`.
   */
  startWaypointIndex?: number;

  /**
   * When `true`, the tour wraps back to the first waypoint after
   * the last and keeps playing. Default `false`.
   */
  loop?: boolean;

  /**
   * When `true` (the default), playback begins immediately. Pass
   * `false` to construct the playback in paused state — useful
   * for connecting UI controls before the camera starts moving.
   */
  autoStart?: boolean;

  /**
   * Fired when the camera arrives at a waypoint and begins its
   * dwell phase.
   */
  onWaypointEnter?: (waypoint: CameraTourWaypoint, index: number) => void;

  /**
   * Fired when the camera leaves a waypoint to start the next
   * leg's transit.
   */
  onWaypointLeave?: (waypoint: CameraTourWaypoint, index: number) => void;

  /**
   * Fired once the tour finishes its final waypoint's dwell.
   * Not fired when `loop: true` is set.
   */
  onFinish?: () => void;
}
