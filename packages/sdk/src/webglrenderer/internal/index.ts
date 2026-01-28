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
 * ***Internal documentation for xeokit developers***
 *
 * ---
 *
 * <br>
 *
 * ## GPU Memory Inspection APIs
 *
 * The WebGLRenderer exposes **diagnostics-only** APIs for inspecting the WebGL2 renderer’s
 * **GPU-resident state**. These APIs are intended for troubleshooting, profiling, and
 * validating renderer behavior, such as batch layout, draw ranges, and the contents of
 * renderer-managed data textures.
 *
 * All GPU inspection APIs are **read-only**. They are not intended to mutate renderer-owned
 * GPU state or influence rendering behavior.
 *
 * The primary entry points are:
 *
 * - {@link MemoryUsage}, returned by {@link WebGLRenderer.getMemoryUsage}, which provides
 *   high-level GPU memory statistics.
 * - {@link MemoryView}, returned by {@link WebGLRenderer.getMemoryView}, which provides
 *   structured, read-only access to GPU-resident {@link DataTextures}.
 *
 * <br>
 *
 * ## Shader Inspection APIs
 *
 * The WebGLRenderer also exposes **diagnostics-only** APIs for inspecting the WebGL2
 * renderer’s **shader programs**. These APIs are intended for troubleshooting, profiling,
 * and validating shader behavior, such as verifying shader code generation and correctness.
 *
 * Shader inspection APIs are **read-only** and are not intended to modify renderer-owned
 * shader state.
 *
 * The primary entry point is:
 *
 * - {@link ShaderView}, returned by {@link WebGLRenderer.getShaderView}, which provides
 *   structured, read-only access to shader program source code.
 *
 * <br>
 *
 * ## Architectural Overview
 *
 * Following [SOLID](https://en.wikipedia.org/wiki/SOLID) principles, the internal structure of the WebGLRenderer is organized as a hierarchy of managers,
 * each responsible for a specific aspect of the rendering pipeline. The following diagram
 * illustrates the key components and their relationships:
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
 * ````
 *
 * The main components are:
 *
 * - **{@link WebGLRenderer}** (public)
 *
 *   - The root entry point for WebGL2 rendering in xeokit.
 *   - Owns and manages the complete rendering pipeline for a {@link Viewer}.
 *   - Attaches to a {@link Viewer}, initializes rendering state, and responds to
 *     scene, view, and model lifecycle events.
 *   - Exposes diagnostics, memory inspection APIs, and renderer error events.
 *   - Owns a single internal {@link ViewManager} instance.
 *
 * - **{@link ViewManager}** (internal)
 *
 *   - Coordinates all per-{@link View} rendering and pipeline management.
 *   - Manages all {@link View} instances owned by a {@link Viewer}.
 *   - Owns and wires together the core rendering subsystems:
 *     - {@link MeshManager}
 *     - {@link GPUMemoryManager}
 *     - {@link RenderManager}
 *     - {@link PickManager}
 *   - Handles view activation, canvas management, and per-view render state.
 *   - Ensures that scene and view changes are reflected in GPU state.
 *
 * - **{@link MeshManager}** (internal)
 *
 *   - Translates scene and view state changes into GPU-ready render state.
 *   - Owns renderer-side representations of models, objects, and meshes, including:
 *     - {@link RendererObject} (per scene object)
 *     - {@link RendererMesh} (per mesh)
 *     - {@link MeshBatchImpl} (batches of compatible meshes)
 *   - Coordinates with {@link GPUMemoryManager} for GPU memory allocation and updates.
 *   - Maintains mesh batches for efficient draw submission.
 *
 * - **{@link GPUMemoryManager}** (internal)
 *
 *   - Allocates, updates, and releases all GPU-resident memory for geometry, attributes,
 *     and data textures.
 *   - Manages the tiled RTC (Relative To Center) coordinate system used for
 *     high-precision rendering.
 *   - Handles all data texture packing and GPU uploads.
 *   - Provides internal APIs for diagnostics and memory inspection.
 *
 * - **{@link RenderManager}** (internal)
 *
 *   - Executes the rendering pipeline for the active {@link View}.
 *   - Manages draw passes, render state, and integration with mesh batches and GPU memory.
 *   - Handles context restoration and per-frame rendering logic.
 *
 * - **{@link PickManager}** (internal)
 *
 *   - Manages GPU-backed picking resources and queries.
 *   - Performs object hit-testing and selection using screen-space or ray-based techniques.
 *   - Integrates with mesh batches and GPU memory infrastructure.
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
