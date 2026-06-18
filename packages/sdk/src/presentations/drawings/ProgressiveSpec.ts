/**
 * Progressive-rendering tuning parameters for {@link DrawingProjectionParams.progressive}.
 */
export interface ProgressiveSpec {
  /**
   * Number of per-source-object createObject calls between
   * yields. Default `50` — roughly one frame per yield on a
   * typical BIM model with HLE on. Smaller values give finer
   * progressive painting at the cost of more yield overhead.
   */
  batchSize?: number;
  /**
   * Custom yield function — called between batches. Defaults
   * to a `requestAnimationFrame`-backed promise (or
   * `setTimeout(0)` outside the browser). Pass your own to
   * pace yields against a scheduler (e.g. `requestIdleCallback`)
   * or to forward through an instrumentation hook.
   */
  yield?: () => Promise<void>;
}
