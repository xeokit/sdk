/**
 * # Renderer Contract
 *
 * Backend-neutral renderer contracts shared by WebGL, future WebGPU, and
 * higher-level viewer integrations.
 *
 * This module describes the stable shape that viewer, Studio, presentation,
 * and spatial-picking code can use without depending on a concrete renderer
 * backend. Applications normally instantiate a backend such as
 * {@link viewing!renderers.webGL.WebGLRenderer | WebGLRenderer}, while reusable
 * tooling can depend on the interfaces exported here.
 *
 * ## Usage
 *
 * ```ts
 * import type { Renderer } from "@xeokit/sdk/viewing/rendering";
 * import { WebGLRenderer } from "@xeokit/sdk/viewing/renderers/webGL";
 *
 * const renderer: Renderer = new WebGLRenderer();
 * ```
 *
 * The contract covers:
 *
 * - lifecycle and context events;
 * - Viewer attachment and teardown;
 * - renderer-backed picking and snapshots.
 *
 * Backend-specific diagnostics, debug hooks, memory internals, shader
 * inspection, and render-bin statistics are intentionally outside this
 * contract. Use the concrete backend module, such as
 * {@link viewing!renderers.webGL.WebGLRenderer | WebGLRenderer}, for those
 * implementation-specific APIs.
 *
 * @module rendering
 */
export * from "./core";
