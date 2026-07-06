/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit Core
 *
 * ---
 *
 * **Core types used across the SDK — result handling, errors,
 * events, tasks, progress, and texture transcoding.**
 *
 * ---
 *
 * `core` holds the small, stable types shared across module
 * boundaries. It has no dependencies on other SDK modules and is
 * safe to import from anywhere.
 *
 * <br>
 *
 * ## Features
 *
 * - **{@link SDKResult}** — return type for fallible SDK operations.
 * - **{@link SDKErrorType}** — machine-readable error categories.
 * - **{@link SDKInternalException}** — internal error type for broken
 *   invariants and impossible states.
 * - **{@link EventEmitter}** — typed event wrapper.
 * - **{@link SDKTask} / {@link SDKTaskRunner}** — cooperative task
 *   queue with progress reporting.
 * - **{@link SDKProgress}** — progress snapshot passed to callbacks.
 * - **{@link TextureTranscoder}** — interface for compressed-texture
 *   transcoding.
 * - **{@link EventsLogger}** — console logger for subscribed events.
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
