/**
 * # xeokit WebGPU Renderer
 *
 * Experimental WebGPU renderer backend for xeokit Viewers.
 *
 * This module currently exposes the public renderer class and event/parameter
 * contracts so integrations can type against WebGPU without depending on
 * WebGL-specific APIs. The WebGPU rendering pipeline is intentionally not
 * enabled yet; `attachViewer`, `pick`, and `getSnapshot` return SDK error
 * results until the backend implementation is wired in.
 *
 * @module viewing/webGPURenderer
 */
export * from "./core";
