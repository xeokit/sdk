/**
 * <img
 *   style="padding-top:20px; padding-bottom:30px; height:100px;"
 *   src="https://xeokit.github.io/sdk/docs/assets/xeokit_webgl_logo.svg"
 * />
 *
 * # WebGLRenderer Internal APIs
 *
 * ---
 *
 * ### *Internal documentation for xeokit developers*
 *
 * ---
 *
 * <br>
 *
 * ## GPU Memory Inspection APIs
 *
 * WebGLRenderer provides **diagnostics-only** APIs for inspecting the WebGL2 renderer’s
 * **GPU-resident state**. They are intended for troubleshooting, profiling, and validating
 * renderer behavior (eg. batch layout, draw ranges, and the contents of renderer-managed
 * data textures).
 *
 * These APIs are **read-only**: they not intended for mutation of renderer-owned GPU state.
 *
 * The main entry points are:
 *
 * - {@link MemoryUsage} returned by {@link WebGLRenderer.getMemoryUsage} for high-level GPU memory stats.
 * - {@link MemoryView} returned by {@link WebGLRenderer.getMemoryView} for structured read-only access to
 *   GPU-resident {@link DataTextures}.
 *
 * <br>
 *
 * ## Shader Inspection APIs
 *
 * WebGLRenderer provides **diagnostics-only** APIs for inspecting the WebGL2 renderer’s
 * **shader programs**. They are intended for troubleshooting, profiling, and validating
 * renderer behavior (eg. verifying shader code generation and correctness).
 *
 * These APIs are **read-only**: they not intended for mutation of renderer-owned shader state.
 *
 * The main entry point is:
 *
 * - {@link ShaderView} returned by {@link WebGLRenderer.getShaderView} for structured read-only access to
 *  shader program source code.
 *
 *  <br>
 *
 * ## Architectural Overview
 *
 * WebGLRenderer is structured as follows:
 *
 * ````
 * WebGLRenderer
 *     ├── Capabilities
 *     ├── MemoryUsage
 *     ├── MemoryView (internal)
 *     ├── MemoryConfigs
 *     ├── WebGLRendererEvents
 *     └── ViewManager (internal)
 *           ├── MeshManager
 *           ├── GPUMemoryManager
 *           ├── RenderManager
 *           ├── PickManager
 *           └── DrawOps
 *
 * ````
 *
 * - **{@link WebGLRenderer}**
 *
 *   - Root entry point for WebGL2 rendering in xeokit.
 *   - Owns and manages the entire rendering pipeline for a {@link Viewer}.
 *   - Attaches to a {@link Viewer}, initializes rendering state, and responds to scene/view/model events.
 *   - Exposes diagnostics, memory inspection, and error events.
 *   - Owns a single internal {@link ViewManager} instance.
 *
 * - **{@link ViewManager}**
 *   - Coordinates all per-{@link View} rendering and pipeline management.
 *   - Manages all {@link View} instances for a {@link Viewer}.
 *   - Owns and wires together the core pipeline managers:
 *     - {@link MeshManager}
 *     - {@link GPUMemoryManager}
 *     - {@link RenderManager}
 *     - {@link PickManager}
 *   - Handles view activation, canvas management, and per-view state.
 *   - Ensures scene/view changes are reflected in GPU state.
 *
 * - **{@link MeshManager}**
 *   - Bridges scene/view state changes into GPU-ready render state.
 *   - Owns renderer-side representations of models, objects, and meshes:
 *     - {@link RendererObject} (per scene object)
 *     - {@link RendererMesh} (per mesh)
 *     - {@link MeshBatchImpl} (batches of compatible meshes)
 *   - Coordinates with {@link GPUMemoryManager} for GPU memory allocation and updates.
 *   - Maintains mesh batches for efficient rendering.
 *
 * - **{@link GPUMemoryManager}**
 *   - Allocates, updates, and releases all GPU-resident memory for geometry, attributes, and data textures.
 *   - Manages tiled RTC (Relative To Center) coordinate system for high-precision rendering.
 *   - Handles all data texture packing and GPU uploads.
 *   - Provides APIs for diagnostics and memory inspection.
 *
 * - **{@link RenderManager}**
 *   - Executes the rendering pipeline for the active view.
 *   - Manages draw passes, render state, and integration with mesh batches and GPU memory.
 *   - Handles context restoration and per-frame rendering logic.
 *
 * - **{@link PickManager}**
 *   - Manages GPU-backed picking resources and queries.
 *   - Handles object hit-testing and selection using screen-space or ray-based picking.
 *   - Integrates with mesh batches and GPU memory.
 *
 * @module internal
 */

export * as viewManager from "../viewManager";
export * from "../../viewer";
export * from "./MemoryView";
export * from "./ShaderView";
export * from "./MemoryDebugger";
export * from "./ShaderDebugger";
export * from "../viewManager/drawOps";
export * from "../viewManager/ViewManager";
export * from "../viewManager/meshManager";
export * from "../viewManager/gpuMemoryManager";
export * from "../viewManager/ViewRenderState";
export * from "../viewManager/gpuMemoryManager/dataTextures/index";
export * from "../viewManager/renderManager";
export * from "../viewManager/pickManager";
