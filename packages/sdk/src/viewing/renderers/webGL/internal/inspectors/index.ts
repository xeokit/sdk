/**
 * # WebGLRenderer Inspectors
 *
 * Internal diagnostics and inspection utilities for the WebGLRenderer.
 *
 * This submodule provides tools for:
 * - Logging and analyzing draw calls and render passes
 * - Inspecting GPU memory usage and data textures
 * - Examining shader programs and techniques
 *
 * These APIs are intended for debugging, profiling, and validation by xeokit developers.
 * They are not part of the public API surface.
 *
 * ## Main Exports
 *
 * - {@link RenderInspector} — Captures and analyzes draw calls and frame timings.
 * - {@link RenderStats} — Log of a frame's rendering operations.
 * - {@link ViewRenderStats} — Log entry for a single render frame.
 * - {@link RenderBinStats} — Log entry for a render bin (pass).
 * - {@link DrawCallStats} — Log entry for a single draw call.
 * - {@link TimeMs} — Time measurement utility.
 * - {@link MemoryInspector} — Read-only view of GPU memory and data textures.
 * - {@link MemoryDebugger} — Interactive GPU memory usage/debugging panel.
 * - {@link ShaderInspector} — Read-only view of renderer shader programs.
 *
 * ## Usage
 *
 * Access these inspectors via the corresponding methods on {@link WebGLRenderer}:
 * - `getRenderInspector()`
 * - `getMemoryInspector()`
 * - `getShaderInspector()`
 *
 * @module inspectors
 * @internal
 */
export * from "./DrawCallStats";
export * from "./RenderInspector";
export * from "./RenderStats";
export * from "./ViewRenderStats";
export * from "./RenderBinStats";
export * from "./TimeMs";
export * from "./MemoryInspector";
export * from "./MemoryDebugger";
export * from "./ShaderInspector";
export * from "./TileStats";
