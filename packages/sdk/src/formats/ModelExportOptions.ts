import {type CoordinateSystemParams} from "../model/scene";
import type {LoaderProgress} from "./LoaderProgress";

/**
 * Options for customizing the export process when exporting a {@link model!scene.SceneModel | SceneModel}
 * and/or a {@link model!data.DataModel | DataModel} to a file.
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
   * {@link base!utils.yieldToHost | yieldToHost}
   * interval that keeps the main thread responsive.
   *
   * Exporters may reuse a single object literal across emits
   * to avoid per-yield allocations — copy out fields you need
   * to retain past the synchronous call.
   */
  onProgress?: (progress: LoaderProgress) => void;

  /**
   * Optional callback for conversion-fidelity warnings — non-fatal notes
   * about something the exporter could not faithfully represent and therefore
   * dropped or flattened (for example, triplanar textures omitted because the
   * target format has no world-projected texturing). When omitted, exporters
   * fall back to `console.warn`. {@link convert!modelConverter.ModelConverter}
   * collects these into each output's `warnings` for the conversion report.
   */
  onWarning?: (message: string) => void;

  /**
   * Minimum gap (in milliseconds) between cooperative yields
   * during the export. Same contract as
   * `ModelLoadOptions.yieldIntervalMs` — raise above the 16ms
   * default to trade UI-update frequency for raw export speed
   * on long-running exports.
   */
  yieldIntervalMs?: number;

} & Record<string, any>;
