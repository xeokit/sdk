/**
 * # GPU Memory Panel
 *
 * Floating, draggable panel that combines the live GPU memory
 * **usage** (allocated / used / free / utilisation bar) and the
 * read-only **configs** (RTC tile size + batch limits) into a
 * single floating panel with two collapsible sections.
 *
 * Live-syncs to the renderer's `onViewRendered` event with
 * per-`requestAnimationFrame` coalescing while visible; detaches
 * cleanly while hidden.
 *
 * @module demo/gpuMemoryUsage
 */
export * from "./GPUMemoryUsage";
