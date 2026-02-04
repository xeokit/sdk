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
 * - {@link DrawCallLog} — Log entry for a single draw call.
 * - {@link DrawInspector} — Captures and analyzes draw calls and frame timings.
 * - {@link DrawLog} — Log of a frame's rendering operations.
 * - {@link FrameLog} — Log entry for a single render frame.
 * - {@link RenderBinLog} — Log entry for a render bin (pass).
 * - {@link TimeMs} — Time measurement utility.
 * - {@link MemoryInspector} — Read-only view of GPU memory and data textures.
 * - {@link MemoryDebugger} — Interactive GPU memory usage/debugging panel.
 * - {@link ShaderInspector} — Read-only view of renderer shader programs.
 *
 * ## Usage
 *
 * Access these inspectors via the corresponding methods on {@link WebGLRenderer}:
 * - `getDrawInspector()`
 * - `getMemoryInspector()`
 * - `getShaderInspector()`
 *
 * @module inspectors
 * @internal
 */
export * from "./DrawCallLog";
export * from "./DrawInspector";
export * from "./DrawLog";
export * from "./FrameLog";
export * from "./RenderBinLog";
export * from "./TimeMs";
export * from "./MemoryInspector";
export * from "./MemoryDebugger";
export * from "./ShaderInspector";
