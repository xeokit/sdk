/**
 * # xeokit WebGPU Renderer
 *
 * WebGPU renderer backend for xeokit Viewers.
 *
 * WebGPURenderer is the WebGPU rendering backend for
 * {@link viewing!viewer.Viewer | Viewer}. It owns WebGPU device acquisition,
 * viewer attachment, render lifecycle events, picking, snapping, memory
 * diagnostics, and render diagnostics. Per-view canvas state and GPU resources
 * are managed internally.
 *
 * The renderer uses browser WebGPU APIs. Use {@link WebGPURenderer.isSupported}
 * before offering WebGPU as a required backend, and prefer
 * {@link WebGPURenderer.create} when the renderer should request its own
 * adapter and device.
 *
 * ## Basic Usage
 *
 * ```ts
 * import {Scene} from "@xeokit/sdk/model/scene";
 * import {Viewer} from "@xeokit/sdk/viewing/viewer";
 * import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
 *
 * const scene = new Scene();
 * const viewer = new Viewer({scene});
 *
 * const result = await WebGPURenderer.create({viewer});
 *
 * if (result.ok) {
 *   const renderer = result.value;
 *
 *   renderer.events.onError.subscribe((_renderer, error) => {
 *     console.error(error.error);
 *   });
 * } else {
 *   console.error(result.error);
 * }
 * ```
 *
 * ## Injecting A Device
 *
 * Pass a pre-created device when another part of the application owns WebGPU
 * device creation.
 *
 * ```ts
 * import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
 *
 * const adapter = await navigator.gpu?.requestAdapter();
 * const device = await adapter?.requestDevice();
 *
 * if (device) {
 *   const renderer = new WebGPURenderer({
 *     device,
 *     destroyDeviceOnDestroy: false
 *   });
 *
 *   renderer.attachViewer(viewer);
 * }
 * ```
 *
 * ## Render And Memory Configuration
 *
 * ```ts
 * import {WebGPURenderer, WEBGPU_RENDER_CONFIG_PROFILES} from "@xeokit/sdk/viewing/renderers/webGPU";
 *
 * const result = await WebGPURenderer.create({
 *   viewer,
 *   memoryConfigs: {
 *     maxBatchVertices: 200000,
 *     maxBatchIndices: 600000,
 *     compactSealedStreamPages: true
 *   },
 *   renderConfigs: {
 *     ...WEBGPU_RENDER_CONFIG_PROFILES.largeModel,
 *     renderBundleCaching: true
 *   }
 * });
 * ```
 *
 * `WEBGPU_RENDER_CONFIG_PROFILES.largeModel` is renderer construction state.
 * Pair it with `DEFAULT_VIEW_PROFILES.fast` when runtime View effects should
 * also use the low-cost profile while navigating.
 *
 * ## Diagnostics
 *
 * ```ts
 * const memory = renderer.getMemoryStats();
 *
 * if (memory) {
 *   console.log(memory.totalBytes);
 *   console.log(memory.packedTrianglePages);
 * }
 *
 * const viewStats = renderer.getViewRenderStats(0);
 *
 * if (viewStats) {
 *   console.log(viewStats.numDrawCalls);
 *   console.log(viewStats.cpuTime.commandEncodingMs);
 * }
 * ```
 *
 * @module webGPU
 */
export * from "./WebGPURenderer";
export * from "./WebGPURendererEvents";
export * from "./WebGPURendererParams";
export * from "./WebGPUViewRenderStats";
export * from "./MemoryConfigs";
export * from "./WebGPURenderConfigs";
export * from "./WebGPUMemoryStats";
