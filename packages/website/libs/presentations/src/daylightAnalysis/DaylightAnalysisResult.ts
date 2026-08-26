import type {AnalysisGrid} from "./DaylightAnalysisParams";
import type {SkyModel} from "./SkyLuminance";


/**
 * Result of a {@link DaylightAnalysis} run.
 *
 * @module presentations/daylightAnalysis
 */
export interface DaylightAnalysisResult {

  /**
   * Per-cell primary metric over the evaluation period. Row-major
   * `[ny][nx]`, packed into a single `Float32Array` of length
   * `nx * ny`. Index `(ix, iy)` lives at `values[iy * nx + ix]`.
   *
   * The unit depends on whether the run used a diffuse sky model:
   *
   *   - `unit === "hours"` (sky model `"none"`): annual cumulative
   *     direct-sun hours, matching the original analysis output.
   *   - `unit === "klux-hours"` (sky model `"cie-overcast"` /
   *     `"uniform"`): annual cumulative horizontal illuminance
   *     proxy in kilolux-hours per year — `directHours · DNI_sin(alt)`
   *     plus `skyFactor · sky_lux(t)`, summed across the year.
   */
  values: Float32Array<any>;

  /** Minimum value across all cells (≥ 0). */
  min: number;

  /** Maximum value across all cells. */
  max: number;

  /** Mean value across all cells. */
  mean: number;

  /** Grid layout the values are sampled on. */
  grid: AnalysisGrid;

  /**
   * Unit of {@link values}:
   *
   *   - `"hours"` — annual direct-sun hours.
   *   - `"klux-hours"` — annual horizontal illuminance in
   *     kilolux-hours, combining direct sun with the diffuse sky
   *     model when one was enabled.
   */
  unit: "hours" | "klux-hours";

  /** Year the analysis ran across. */
  year: number;

  /** Number of time-samples per evaluated day. */
  hoursPerDay: number;

  /** Number of days evaluated. */
  daysEvaluated: number;

  /** Sky-luminance model used. */
  skyModel: SkyModel;

  /**
   * Per-cell direct-sun hours over the evaluation period — always
   * populated regardless of `skyModel`, so callers that want the
   * raw direct metric (e.g. for BRE 209 right-to-light tests) can
   * read it even when `values` carries a combined-illuminance
   * proxy. Same shape and indexing as {@link values}.
   */
  directHours: Float32Array<any>;

  /**
   * Per-cell Sky View Factor in `[0, 1]` under the luminance-
   * weighted estimator for the chosen sky model — `null` when
   * `skyModel` is `"none"`. `1.0` means an unobstructed view of the
   * sky for that cell; `0.0` means fully roofed over.
   */
  skyFactor: Float32Array<any> | null;
}
