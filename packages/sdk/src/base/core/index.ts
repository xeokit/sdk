/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="../../assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit Core
 *
 * ---
 *
 * **Foundational primitives every other SDK module depends on —
 * result types, error taxonomy, event dispatcher, task runner, and
 * progress reporting.**
 *
 * ---
 *
 * `core` carries the small, stable types that the rest of the SDK
 * exchanges across module boundaries. It has no dependencies on
 * other SDK modules and is safe to import from anywhere.
 *
 * <br>
 *
 * ## Features
 *
 * - **{@link SDKResult}** — discriminated union covering every
 *   fallible operation in the SDK. `if (r.ok) { use r.value }` vs
 *   `r.error / r.type`. Never throw for caller errors; always
 *   return an `SDKResult`.
 * - **{@link SDKErrorType}** — small enum of error categories
 *   (`InvalidInput`, `InvalidOperation`, `NotSupported`,
 *   `OutOfMemory`, …) so callers can branch on machine-readable
 *   error kinds instead of string-matching messages.
 * - **{@link SDKInternalException}** — thrown for *internal* SDK
 *   bugs (broken invariants, impossible states). Surfaces to the
 *   host as a regular `Error` with a typed `SDKErrorType` tag.
 * - **{@link EventEmitter}** — typed wrapper around
 *   `strongly-typed-events`. Every event in the SDK is exposed as
 *   an `EventEmitter<Source, Payload>` with `subscribe()` returning
 *   an unsubscribe function.
 * - **{@link SDKTask} / {@link SDKTaskRunner}** — cooperative task
 *   queue with progress reporting; used by the Demo task panel and
 *   by long-running converter pipelines.
 * - **{@link SDKProgress}** — `{phase, current, total}` snapshot
 *   passed to caller progress callbacks during loading / exporting /
 *   inspecting.
 * - **{@link TextureTranscoder}** — abstract interface for
 *   transcoding compressed-texture payloads (Basis Universal,
 *   KTX2) to GPU-native formats; implementations provided by
 *   format-specific loaders.
 * - **{@link EventsLogger}** — opt-in observer that mirrors every
 *   subscribed event to the console; useful for debugging event
 *   flow.
 *
 * <br>
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * <br>
 *
 * ## Quick Start
 *
 * ### 1) Branch on SDKResult
 *
 * ```javascript
 * import { SDKResult, SDKErrorType } from "@xeokit/sdk/base/core";
 *
 * const r = doThing();
 * if (r.ok) {
 *   useValue(r.value);
 * } else if (r.type === SDKErrorType.NotSupported) {
 *   showFallback();
 * } else {
 *   console.error(r.error);
 * }
 * ```
 *
 * <br>
 *
 * ### 2) Subscribe to an EventEmitter
 *
 * ```javascript
 * const unsub = viewer.events.onError.subscribe((source, err) => {
 *   console.warn(`[${source.id}] ${err.error}`);
 * });
 *
 * // ...later:
 * unsub();
 * ```
 *
 * @module core
 */

export * from "./SDKTask";
export * from "./SDKTaskRunner";
export * from "./SDKResult";
export * from "./SDKInternalException";
export * from "./EventEmitter";
export * from "./TextureTranscoder";
export * from "./TextureCompressedParams";
export * from "./ModelChunksManifestParams";
export * from "./SDKErrorType";
export * from "./EventsLogger";
export * from "./SDKProgress";
