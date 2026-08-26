import type {CameraTour} from "../plan/CameraTour";


/**
 * Control handle returned by {@link playCameraTour}. Callers
 * keep this around as long as they want playback running — call
 * {@link CameraTourPlayback.destroy} to release the tick
 * subscription.
 */
export interface CameraTourPlayback {

  /** Resume playback after `pause()`. No-op if already playing. */
  play(): void;

  /**
   * Pause playback. The camera stays where it is and time stops
   * accumulating; `play()` resumes from the exact same position.
   */
  pause(): void;

  /**
   * Stop playback. Equivalent to `pause()` but also resets the
   * cursor to the start waypoint — calling `play()` again
   * restarts the tour from the beginning.
   */
  stop(): void;

  /**
   * Teleport the camera to a specific waypoint and start its
   * dwell phase. Out-of-range indices are silently clamped to
   * `[0, waypoints.length - 1]` (no throw).
   */
  seek(waypointIndex: number): void;

  /** Release the tick subscription. Idempotent. */
  destroy(): void;

  /** `true` if currently advancing time. */
  readonly playing: boolean;

  /**
   * Index of the most-recently-arrived-at waypoint. While the
   * camera is in transit from `i` to `i + 1`, this still reads
   * `i` — it flips to `i + 1` when the transit completes and the
   * destination dwell begins.
   */
  readonly currentWaypointIndex: number;

  /** The tour being played. Same instance passed to {@link playCameraTour}. */
  readonly tour: CameraTour;
}
