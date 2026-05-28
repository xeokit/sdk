import type {SunStudy} from "./SunStudy";


/**
 * Parameters for {@link AnnualSunPlayer | AnnualSunPlayer}.
 *
 * @module presentations/sunStudy
 */
export interface AnnualSunPlayerParams {

  /** The SunStudy this player drives. */
  sunStudy: SunStudy;

  /**
   * Playback mode — selects what the cursor sweeps when playing.
   *
   * - `"day"` — sweeps from `00:00` to `24:00` on the cursor's
   *   current date, looping. Useful for "day-in-the-life" shadow
   *   sweep visualisations.
   * - `"year"` — sweeps from Jan 1 to Dec 31 at the cursor's
   *   current hour-of-day, looping. Useful for solstice-to-solstice
   *   shadow envelope studies.
   *
   * Default `"day"`.
   */
  mode?: "day" | "year";

  /**
   * Playback rate.
   *
   * - In `"day"` mode: real-time seconds per simulated day. Default
   *   `8` — sunrise to sunset in 4 real-time seconds plus a few seconds
   *   of night.
   * - In `"year"` mode: real-time seconds per simulated year. Default
   *   `30` — a full Jan-to-Dec sweep in 30 seconds.
   */
  durationSeconds?: number;

  /** Start playing immediately. Default `false`. */
  autoPlay?: boolean;
}
