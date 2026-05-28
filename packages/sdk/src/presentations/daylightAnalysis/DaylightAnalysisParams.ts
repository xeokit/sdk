import type {SunStudy} from "../sunStudy";
import type {Scene} from "../../model/scene";
import type {SkyModel} from "./SkyLuminance";


/**
 * Defines the rectangular work-plane the analysis samples.
 *
 * Most daylight-compliance protocols (LEED EQ 8.1, BREEAM Hea 01,
 * EN 17037 §6.2) specify a horizontal evaluation plane at the work-
 * plane height — `floor + 800 mm` for desk-height analysis,
 * `floor + 0 mm` for entry-level light. Use that plane's world-space
 * bounding rect for `min` / `max`.
 *
 * @module presentations/daylightAnalysis
 */
export interface AnalysisGrid {
  /** World-space minimum corner of the work plane (x, y, z). */
  min: [number, number, number];
  /** World-space maximum corner of the work plane (x, y, z). */
  max: [number, number, number];
  /** Number of cells along the (x, y) axes. Resolution scales as
   *  `nx × ny` — the runtime cost is roughly `nx × ny × times`. */
  resolution: [number, number];
}


/**
 * Parameters for {@link DaylightAnalysis | DaylightAnalysis}.
 *
 * @module presentations/daylightAnalysis
 */
export interface DaylightAnalysisParams {

  /**
   * SunStudy providing the site location (latitude / longitude /
   * northAngleDegrees). The analysis ignores the SunStudy's
   * `currentDate` — it walks its own time samples independently —
   * but reuses the site coordinates and north angle.
   */
  sunStudy: SunStudy;

  /** Scene whose objects act as occluders. */
  scene: Scene;

  /** Rectangular work-plane sample grid. */
  grid: AnalysisGrid;

  /**
   * Year to evaluate. Defaults to the **current calendar year**.
   */
  year?: number;

  /**
   * Number of evenly-spaced sample days through the year. Default
   * `12` — one per month. Increase for finer time resolution at the
   * cost of linear runtime growth. `52` (weekly) or `365` (daily)
   * are reasonable next steps.
   */
  daysPerYear?: number;

  /**
   * Number of evenly-spaced sample hours through each evaluated day.
   * Default `24` — hourly. Drop to `12` to halve the time cost.
   */
  hoursPerDay?: number;

  /**
   * Sun altitudes below this threshold (degrees) are skipped — the
   * sun's contribution is negligible at horizon angles, and the
   * raycast against the BVH would dominate runtime without changing
   * the answer. Default `5°`.
   */
  minSunAltitudeDeg?: number;

  /**
   * How many ms an `await yieldToHost()` pause needs to honor. The
   * analysis runner yields periodically so the browser stays
   * responsive during the long raycast sweep. Default `16` (60 Hz).
   */
  yieldIntervalMs?: number;

  /**
   * Diffuse-sky model layered on top of the direct-sun raycast. When
   * non-`"none"`, each cell additionally fires `skySamples` cosine-
   * weighted rays into the upper hemisphere to estimate its Sky View
   * Factor under the chosen luminance model, then combines that
   * with the direct-sun term to produce an annual horizontal
   * illuminance proxy (in `klux·hours`) on the result.
   *
   *   - `"none"` (default) — direct-sun only. `result.unit` stays
   *     `"hours"` and `result.values` holds annual sunlit hours,
   *     matching the previous behaviour exactly.
   *   - `"cie-overcast"` — CIE Standard Overcast Sky (CIE 1955).
   *     Brighter at zenith, dimmer at horizon — the canonical
   *     daylight-factor sky and the basis of UK BRE 209 / EN 17037
   *     calculations.
   *   - `"uniform"` — Uniform sky luminance (CIE 1). Simpler,
   *     useful as a baseline for "any sky at all" view-factor work.
   *
   * Sky modelling roughly doubles runtime (`skySamples` extra rays
   * per cell on top of the existing time-step sweep).
   */
  skyModel?: SkyModel;

  /**
   * Number of cosine-weighted hemisphere samples per cell when
   * `skyModel` is non-`"none"`. Default `64` — enough Hammersley
   * stratification for a smooth SVF estimate at typical grid
   * resolutions; bump to `128`/`256` for noise-free output at the
   * cost of linear runtime growth.
   */
  skySamples?: number;
}
