import {type CoordinateSystemParams} from "../scene";
import type {LoaderProgress} from "./LoaderProgress";

/**
 * Options for customizing the export process when exporting a {@link scene!SceneModel | SceneModel}
 * and/or a {@link data!DataModel | DataModel} to a file.
 */
export type ModelExportOptions = {

  /**
   * Optional target CoordinateSystem for export. If not provided,
   * the SceneModel's CoordinateSystem will be used.
   */
  coordinateSystem?: CoordinateSystemParams;

  /**
   * Optional `AbortSignal`. Exporters that have been swept to
   * cooperative-yield check `signal.aborted` at every yield
   * point and throw a `DOMException("Aborted", "AbortError")`
   * when the caller cancels. Exporters that pre-date the sweep
   * ignore this field and run to completion.
   */
  signal?: AbortSignal;

  /**
   * Optional progress callback. Same contract as
   * `ModelLoadOptions.onProgress` — the exporter fires this
   * from inside its hot loops at ≈60 Hz, paced by the same
   * {@link "@xeokit/sdk/utils".yieldToHost | yieldToHost}
   * interval that keeps the main thread responsive.
   *
   * Exporters may reuse a single object literal across emits
   * to avoid per-yield allocations — copy out fields you need
   * to retain past the synchronous call.
   */
  onProgress?: (progress: LoaderProgress) => void;

  /**
   * Minimum gap (in milliseconds) between cooperative yields
   * during the export. Same contract as
   * `ModelLoadOptions.yieldIntervalMs` — raise above the 16ms
   * default to trade UI-update frequency for raw export speed
   * on long-running exports.
   */
  yieldIntervalMs?: number;

} & Record<string, any>;
