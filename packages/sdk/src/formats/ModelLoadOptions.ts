import type {CoordinateSystemParams, SceneObject} from "../scene";
import type {LoaderProgress} from "./LoaderProgress";

/**
 * Options for {@link ModelLoader.load | ModelLoader.load}.
 */
export interface ModelLoadOptions {

  /**
   * Describes the coordinate system of the model to load.
   *
   * When provided, this enables the loader to automatically transform the model
   * from its local oordinate system to the Scene's global coordinate system.
   */
  coordinateSystem?: CoordinateSystemParams;

  /**
   * Optional layer ID to assign to all {@link SceneObject | SceneObjects} created by the loader.
   *
   * See {@link SceneObject.layerId | SceneObject.layerId} for details on how this layer ID
   * is used when the Scene is attached to a {@link viewer!Viewer | Viewer}.
   */
  layerId?: string;

  /**
   * Optional base URL used by formats that reference external resources
   * (e.g. glTF's separate `.bin` and texture files). When set, the loader
   * resolves relative URIs in the model file against this base — set this
   * to the directory the model lives in.
   */
  baseUri?: string;

  /**
   * Optional `AbortSignal`. Loaders that have been swept to
   * cooperative-yield (every modern parser in `formats/`)
   * check `signal.aborted` at every yield point and throw a
   * `DOMException("Aborted", "AbortError")` when the caller
   * cancels — combine with the signal your UI uses for the
   * Cancel button on a load dialog.
   *
   * Loaders that pre-date the sweep ignore this field and run
   * to completion regardless — passing it is safe in either
   * case.
   */
  signal?: AbortSignal;

  /**
   * Optional progress callback. Loaders fire this from inside
   * their hot loops at roughly 60 Hz (paced by the same
   * {@link "@xeokit/sdk/utils".yieldToHost | yieldToHost}
   * interval that keeps the main thread responsive). UIs
   * subscribe to drive a progress bar / phase label /
   * cancellable dialog.
   *
   * The callback receives a {@link LoaderProgress} object
   * literal. Loaders may reuse the same object across emits —
   * copy out any fields you need to retain past the synchronous
   * call.
   */
  onProgress?: (progress: LoaderProgress) => void;

  /**
   * Minimum gap (in milliseconds) between cooperative yields
   * during the load. The default of 16ms (≈ 60 Hz) keeps the UI
   * fully responsive but pays the `setTimeout(0)` overhead
   * (~4 ms per yield on most browsers) on every animation
   * frame, which adds up across a long load. Raising this to
   * 50–100ms cuts that overhead and noticeably speeds up large
   * loads, at the cost of progress-bar / paint updates landing
   * at 10–20 Hz instead of 60 Hz.
   *
   * Values under 16ms are clamped to 16ms — going below the
   * default doesn't increase perceived smoothness and only adds
   * yield overhead.
   *
   * Loaders that pre-date the cooperative-yield sweep ignore
   * this field; passing it is safe in either case.
   */
  yieldIntervalMs?: number;
}
