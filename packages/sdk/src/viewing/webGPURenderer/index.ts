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
 * color, plus renderer-backed picking and first-pass vertex/edge snapping.
 * Pick/snap now have WebGPU resource and draw-technique boundaries aligned
 * with WebGLRenderer, while their public synchronous result path still uses
 * renderer-side triangle traversal until async GPU readback replaces it.
 * Materials, points, lines, and snapshots are intentionally not implemented
 * yet.
 *
 * @module viewing/webGPURenderer
 */
export * from "./core";
export * from "./MemoryConfigs";
export * from "./createMemoryConfigs";
export * from "./WebGPURenderConfigs";
export * from "./createWebGPURenderConfigs";
export * from "./WebGPUMemoryStats";
