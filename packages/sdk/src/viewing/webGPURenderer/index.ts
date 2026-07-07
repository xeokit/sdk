/**
 * # xeokit WebGPU Renderer
 *
 * Experimental WebGPU renderer backend for xeokit Viewers.
 *
 * This module exposes the public renderer class and event/parameter contracts
 * so integrations can type against WebGPU without depending on WebGL-specific
 * APIs. The current backend can attach to a Viewer with an initialized WebGPU
 * device, configure View canvases, clear dirty Views, and draw a first narrow
 * depth-buffered path for indexed triangle-family meshes with flat per-mesh
 * color. Materials, edges, points, lines, picking, and snapshots are intentionally not
 * implemented yet.
 *
 * @module viewing/webGPURenderer
 */
export * from "./core";
