/**
 * Progress payload emitted by model loaders to their `onProgress`
 * callback. Loaders fire this from inside their hot loops at
 * roughly the same cadence as `yieldToHost` (≈60 Hz) so a UI bar
 * can advance smoothly without per-item event overhead.
 *
 * Keep the payload tiny — it's allocated once per emit. Loaders
 * may reuse a single object literal across emits so consumers
 * should not retain it past the synchronous callback.
 */
export interface LoaderProgress {

  /**
   * Short, human-readable phase label — what the loader is
   * doing right now. Examples: `"Fetching"`, `"Parsing entities"`,
   * `"Building meshes"`, `"Finalising"`. UIs typically show this
   * as the line above the progress bar.
   */
  phase: string;

  /**
   * Items completed so far in the current phase. May reset to
   * zero when `phase` changes.
   */
  current: number;

  /**
   * Total items expected in the current phase. Pass `0` (or any
   * non-positive value) when the total is unknown — UIs render
   * an indeterminate bar in that case.
   */
  total: number;

  /**
   * Optional one-line detail, surfaced beneath the phase label
   * (e.g. the id of the entity being parsed). Omit when noisy.
   */
  detail?: string;
}
