/**
 * <img
 *   style="padding-top:20px; padding-bottom:30px; height:100px;"
 *   src="https://xeokit.github.io/sdk/docs/assets/xeokit_webgl_logo.svg"
 * />
 *
 * # WebGLRenderer Internals
 *
 * ---
 *
 * **Internal documentation for xeokit developers**
 *
 * ---
 *
 * <br>
 *
 * ## Overview
 *
 * This module documents the **internal architecture** of xeokit’s WebGL2 rendering backend.
 * It is intended for contributors and maintainers of the renderer, not for public API usage.
 *
 * The {@link WebGLRenderer} follows **SOLID principles** and is structured as a hierarchy
 * of specialized managers, each responsible for a clearly defined aspect of the rendering
 * pipeline.
 *
 * <br>
 *
 * ## Internal Structure
 *
 * The public {@link WebGLRenderer} owns a set of high-level facilities and a single internal
 * {@link ViewManager}, which coordinates all rendering work.
 *
 * ```md
 * WebGLRenderer
 * ├── Capabilities -- Read-only, describes WebGL2 capabilities
 * ├── MemoryUsage -- Memory usage info
 * ├── MemoryView -- GPU memory and shader diagnostics
 * ├── MemoryConfigs -- GPU memory budgeting configs
 * ├── WebGLRendererEvents -- Renderer lifecycle and error events
 * └── internal
 *     ├── ViewManager -- Internal coordinator for per-View rendering
 *     ├── MeshManager -- Manages mesh batching and renderer-side representations
 *     ├── GPUMemoryManager -- Manages GPU-resident memory
 *     ├── RenderManager -- Executes the render pipeline
 *     ├── PickManager -- Manages GPU picking
 *     └── DrawOps -- Low-level WebGL draw infrastructure
 * ```
 *
 * <br>
 *
 * ## Architectural Relationships
 *
 * The following class diagram shows the main internal components and how they interact.
 * Ownership relationships are shown as compositions, while data flow and notifications
 * are shown as directed associations.
 *
 * ```mermaid
 * classDiagram
 *     Scene *--> SceneEvents : emits
 *     Viewer --> SceneEvents : subscribes
 *     Viewer *--> ViewerEvents : emits
 *     WebGLRenderer --> ViewerEvents : subscribes
 *     WebGLRenderer:memoryUsage
 *     WebGLRenderer:memoryView
 *     WebGLRenderer:memoryConfigs
 *     WebGLRenderer:events
 *     WebGLRenderer --> SceneEvents : subscribes
 *     WebGLRenderer *--> ViewManager : delegates
 *     ViewManager *--> MeshManager : scene & view changes
 *     MeshManager *--> GPUMemoryManager : write
 *     ViewManager *--> RenderManager : repaint
 *     ViewManager *--> PickManager : pick
 *     MeshManager *--> "*" MeshBatchImpl
 *     MeshBatchImpl *--> "*" RendererObject
 *     MeshBatchImpl *--> "*" RendererMesh
 *     MeshBatchImpl *--> "*" RendererGeometry
 *     RendererGeometry --> GPUMemoryManager : write
 *     RendererObject --> GPUMemoryManager : write
 *     GPUMemoryManager *--> DataTextures
 *     RenderManager --> DrawOps : draw
 *     PickManager --> DrawOps : pick
 *     DrawOps *--> "*" RenderPassDrawOps
 *     RenderPassDrawOps *--> "*" DrawOp
 *     DrawOp *--> DrawTechnique
 *     DrawOp --> MeshBatchImpl : draw
 *     DrawOp:drawBatch()
 *     RendererMesh --> GPUMemoryManager : write
 *     DrawTechnique --> DataTextures : bind/read
 *     WebGLRendererEvents <--* WebGLRenderer : emits
 *     WebGLRendererEvents:onError()
 *     WebGLRendererEvents:onWebGLContextLost()
 *     WebGLRendererEvents:onWebGLContextRestored()
 *     WebGLRendererEvents:onViewerAttached()
 *     WebGLRendererEvents:onViewerDetached()
 *     WebGLRendererEvents:onRendererStarted()
 *     WebGLRendererEvents:onRendererStopped()
 *     WebGLRendererEvents:onRendererDestroyed()
 * ```
 *
 * <br>
 *
 * ## Core Components
 *
 * ### WebGLRenderer (public)
 *
 * - {@link WebGLRenderer}
 * - Public root entry point for WebGL2 rendering in xeokit.
 * - Owns the complete rendering pipeline for a {@link Viewer}.
 * - Observes {@link Scene} and {@link Viewer} lifecycle events.
 * - Exposes diagnostics and memory inspection APIs:
 *   - {@link MemoryUsage} -- high-level GPU memory statistics
 *   - {@link MemoryView} -- inspects contents of {@link DataTextures}
 *   - {@link ShaderView} -- inspects shaders, source code etc.
 * - Emits lifecycle events via {@link WebGLRendererEvents}.
 * - Owns exactly one internal {@link ViewManager}.
 *
 * ---
 *
 * ### ViewManager (internal)
 *
 * - {@link ViewManager}
 * - Central coordinator for all per-{@link View} rendering.
 * - Manages the lifecycle of {@link View} instances owned by a {@link Viewer}.
 * - Owns and wires together the core subsystems:
 *   - {@link MeshManager}
 *   - {@link GPUMemoryManager}
 *   - {@link RenderManager}
 *   - {@link PickManager}
 * - Ensures scene and view state changes are reflected in GPU state.
 *
 * ---
 *
 * ### MeshManager (internal)
 *
 * - {@link MeshManager}
 * - Translates scene and view changes into GPU-ready render state.
 * - Owns renderer-side representations:
 *   - {@link RendererObject} — per scene object
 *   - {@link RendererMesh} — per mesh
 *   - {@link MeshBatchImpl} — batches of compatible meshes
 *   - {@link MeshBatch} - drawable interface for a MeshBatchImpl
 * - Maintains mesh batches for efficient draw submission.
 * - Coordinates GPU updates with {@link GPUMemoryManager}.
 *
 * ---
 *
 * ### GPUMemoryManager (internal)
 *
 * - {@link GPUMemoryManager}
 * - Allocates, updates, and releases all GPU-resident memory.
 * - Manages geometry buffers, attributes, and {@link DataTextures}.
 * - Implements the tiled RTC (Relative To Center) coordinate system
 *   for high-precision rendering.
 * - Provides diagnostics and inspection APIs.
 *
 * ---
 *
 * ### RenderManager (internal)
 *
 * - {@link RenderManager}
 * - Executes the render pipeline for the active {@link View}.
 * - Manages render passes, frame state, and draw submission.
 * - Integrates mesh batches and GPU memory into per-frame rendering.
 * - Handles WebGL context restoration.
 *
 * ---
 *
 * ### PickManager (internal)
 *
 * - {@link PickManager}
 * - Manages GPU-backed picking resources.
 * - Performs object hit-testing via screen-space or ray-based picking.
 * - Shares mesh batches and GPU memory infrastructure with rendering.
 *
 * ---
 *
 * ### DrawOps (internal)
 *
 * Low-level WebGL2 draw infrastructure used by both rendering and picking.
 *
 * - {@link DrawTechnique}
 *   - Abstract rendering technique.
 *   - Defines shader generation, program setup, uniform loading, and draw calls.
 *   - Subclasses implement specific techniques (color, highlight, x-ray, etc.)
 *     for specific primitive types.
 *
 * - {@link DrawOp}
 *   - Applies a {@link DrawTechnique} for a specific render pass.
 *
 * - {@link RenderPassDrawOps}
 *   - Collection of {@link DrawOp} instances for all render passes
 *     of a single primitive type.
 *
 * - {@link DrawOps}
 *   - Complete set of draw operations for all primitive types.
 *
 * - {@link getDrawOps} / {@link putDrawOps}
 *   - Internal pooling APIs for caching and reusing DrawOps instances.
 *
 * <br>
 *
 * ---
 *
 * ### Execution Workflows
 *
 * The following selected workflows illustrate how the core components interact
 * during key operations.
 *
 * #### Viewer Attached to WebGLRenderer
 *
 * This is when the WebGLRenderer gets initialized, ready for action.
 *
 * 1. **Viewer** is created.
 * 2. **WebGLRenderer.attach(viewer)**
 * 3. **WebGLRenderer** initializes rendering state for the Viewer.
 * 4. **WebGLRenderer** creates a **ViewManager** for the Viewer.
 * 5. **ViewManager** initializes:
 *     - **MeshManager**
 *     - **GPUMemoryManager**
 *     - **RenderManager**
 *     - **PickManager**
 * 6. **WebGLRenderer** subscribes to Viewer and Scene events.
 * 7. Viewer is now ready for rendering.
 *
 * ---
 *
 * #### SceneGeometry Creation
 *
 * Whenever geometries are created, they get pre-loaded into the renderer.
 *
 * 1. **SceneGeometry** is created in **SceneMesh**.
 * 2. **WebGLRenderer** is notified via **SceneEvents.onGeometryCreated**.
 * 3. **ViewManager.sceneGeometryCreated(sceneGeometry)**
 * 4. **MeshManager.sceneGeometryCreated(sceneGeometry)**
 * 5. **MeshManager** prepares to create **RendererGeometry** when needed.
 * 6. **RendererGeometry** is created when first used by a **SceneMesh**.
 * 7. **RendererGeometry** requests GPU memory allocation: **GPUMemoryManager.createGeometryBuffers()**
 * 8. **GPUMemoryManager** allocates buffers and uploads geometry data.
 * 9. **RendererGeometry** is ready for inclusion in a **RendererMesh**.
 *
 * ---
 *
 * #### SceneMesh Creation
 *
 * Whenever meshes are created, they get loaded into the renderer, and are attached
 * to **RendererMesh** instances.
 *
 * 1. **SceneMesh** is created in **SceneObject**.
 * 2. **WebGLRenderer** is notified via **SceneEvents.onSceneMeshCreated**.
 * 3. **ViewManager.sceneMeshCreated(sceneMesh)**
 * 4. **MeshManager.sceneMeshCreated(sceneMesh)**
 * 5. **MeshManager** requests GPU memory allocation: **GPUMemoryManager.createBatch()**
 * 6. **GPUMemoryManager** allocates buffers and uploads geometry data.
 * 7. **MeshManager** adds **RendererMesh** to **MeshBatchImpl**.
 * 8. **RendererMesh** is ready for inclusion in a **RendererObject**.
 *
 * ---
 *
 * #### SceneObject Creation
 *
 * Whenever objects are created, they get loaded into the renderer, and are attached
 * to **RendererObject** instances. No re-render yet, wait for View update.
 *
 * 1. **SceneObject** is created in **Scene**.
 * 2. **Viewer** is notified via **SceneEvents.onObjectCreated**.
 * 3. **ViewObject** is created in **View** for the **SceneObject**.
 * 4. **WebGLRenderer** is notified of new **SceneObject**.
 * 5. **ViewManager.sceneObjectCreated(sceneObject)**
 * 6. **MeshManager.sceneObjectCreated(sceneObject)**
 * 7. **MeshManager** finds pre-created **RendererMesh** instances for each mesh (see SceneMesh Creation).
 * 8. **MeshManager** creates **RendererObject** and links **RendererMesh** instances.
 * 9. **RendererObject** and its **RendererMesh** instances are ready for rendering.
 *
 * ---
 *
 * #### SceneObject Deletion
 *
 * Whenever objects are deleted, they get unloaded from the renderer. The **RendererMesh** and
 * **RendererObject** instances are not unloaded immediately, but are instead kept in memory
 * for potential reuse. No re-render yet, wait for View update.
 *
 * 1. **SceneObject** is deleted in **Scene**.
 * 2. **Viewer** is notified via **SceneEvents.onObjectDestroyed**.
 * 3. **ViewObject** is deleted in **View**.
 * 4. **WebGLRenderer** is notified of deletion.
 * 5. **ViewManager.sceneObjectDestroyed(sceneObject)**
 * 6. **MeshManager.sceneObjectDestroyed(sceneObject)**
 * 7. **MeshManager** removes **RendererMesh** instances from **MeshBatchImpl**.
 * 8. **MeshManager** notifies **GPUMemoryManager** to release GPU memory.
 * 9. **GPUMemoryManager** releases buffers and data textures.
 * 10. **RendererObject** and **RendererMesh** instances are destroyed.
 *
 * ---
 *
 * #### ViewObject Visibility Change
 *
 * Whenever a ViewObject's visibility is changed, the renderer updates
 * the visibility state in GPU memory, so that only visible objects
 * are rendered. No re-render yet, wait for View update.
 *
 * 1. **ViewObject** visibility is changed in **View**.
 * 2. **WebGLRenderer** is notified via **ViewEvents.onViewObjectVisibilityChanged**.
 * 3. **ViewManager.viewObjectVisibilityChanged(viewObject)**
 * 4. **MeshManager.viewObjectVisibilityChanged(viewObject)**
 * 5. **MeshManager** marks the **RendererObject** as visible/invisible.
 * 6. **MeshManager** uploads visibility state to **GPUMemoryManager**.
 * 7. On next render, **RenderManager** queries visible **RendererObjects** from **MeshManager**.
 * 8. **RenderManager** issues draw calls only for visible **RendererObjects**.
 *
 * ---
 *
 * #### SceneMesh Matrix Update
 *
 * Whenever a SceneMesh's matrix is updated, the renderer updates
 * the matrix data in GPU memory. No re-render yet, wait for View update.
 *
 * 1. **SceneMesh** matrix is updated in **Scene**.
 * 2. **WebGLRenderer** is notified via **SceneEvents.onMeshMatrixUpdated**.
 * 3. **ViewManager.sceneMeshMatrixChanged(sceneMesh)**
 * 4. **MeshManager.sceneMeshMatrixChanged(sceneMesh)**
 * 5. **MeshManager** updates matrix data in **GPUMemoryManager**.
 * 6. **GPUMemoryManager** uploads updated matrix to GPU.
 * 7. On next render, **RenderManager** uses updated matrix for rendering.
 *
 * ---
 *
 * #### SceneMesh Color Update
 *
 * Whenever a SceneMesh's color is updated, the renderer updates
 * the color data in GPU memory. No re-render yet, wait for View update.
 *
 * 1. **SceneMesh** color is updated in **Scene**.
 * 2. **WebGLRenderer** is notified via **SceneEvents.onMeshColorUpdated**.
 * 3. **ViewManager.sceneMeshColorChanged(sceneMesh)**
 * 4. **MeshManager.sceneMeshColorChanged(sceneMesh)**
 * 5. **MeshManager** updates color data in **GPUMemoryManager**.
 * 6. **GPUMemoryManager** uploads updated color to GPU.
 * 7. On next render, **RenderManager** uses updated color for rendering.
 *
 * ---
 *
 * #### View Updated (View ready to re-render)
 *
 * Whenever a View is ready to be re-rendered, the renderer
 * executes the render pipeline.
 *
 * 1. **Viewer** requests a frame render.
 * 2. **WebGLRenderer** is notified via **ViewerEvents.onViewUpdated**.
 * 3. **ViewManager** initiates render via **RenderManager**.
 * 4. **RenderManager** retrieves visible **RendererObjects** from **MeshManager**.
 * 5. **RenderManager** sets up render passes and state.
 * 6. **RenderManager** issues draw calls using **DrawOps** for each visible **RendererObject**.
 * 7. Frame is rendered to the canvas.
 *
 * ---
 *
 * #### Picking Operation
 *
 * 1. User initiates picking on a **View** canvas.
 * 2. **WebGLRenderer.pick(...)** is called.
 * 3. **ViewManager** delegates to **PickManager**.
 * 4. **PickManager** sets up picking render targets and state.
 * 5. **PickManager** issues draw calls using **DrawOps** to render to picking buffer.
 * 6. **PickManager** reads picking results from GPU.
 * 7. **PickManager** identifies picked **ViewObject** and notifies **WebGLRenderer**.
 * 8. **WebGLRenderer.pick** returns result to caller.
 * 9. Caller can find picked **SceneObject** via **ViewObject**.
 *
 * ---
 *
 *
 * ## GPU Memory Inspection (Diagnostics)
 *
 * The WebGLRenderer exposes **read-only diagnostics APIs** for inspecting
 * GPU-resident renderer state. These APIs are intended for debugging,
 * profiling, and validation only.
 *
 * Primary entry points:
 *
 * - {@link MemoryUsage} via {@link WebGLRenderer.getMemoryUsage}
 *   — high-level GPU memory statistics.
 * - {@link MemoryView} via {@link WebGLRenderer.getMemoryView}
 *   — structured, read-only access to {@link DataTextures}.
 *
 * <br>
 *
 * ## Shader Inspection (Diagnostics)
 *
 * Read-only APIs for inspecting generated WebGL shader programs.
 *
 * - {@link ShaderView} via {@link WebGLRenderer.getShaderView}
 *   — structured access to shader source code.
 *
 * @module internal
 */


import type {MeshManager, RendererObject, RendererMesh, MeshBatchImpl} from "./meshManager";
import type {WebGLRenderer} from "../WebGLRenderer";
import type {DrawTechnique, DrawOps,  RenderPassDrawOps, DrawOp, getDrawOps, putDrawOps} from "./drawOps";
import type { Viewer, View, ViewObject} from "../../viewer";
import type {Scene, SceneObject, SceneMesh, SceneGeometry} from "../../scene";
import {type GPUMemoryManager} from "./gpuMemoryManager/GPUMemoryManager";
import {type RenderManager} from "./renderManager/RenderManager";
import {type PickManager} from "./pickManager/PickManager";

export * as drawOps from "./drawOps";
export * as gpuMemoryManager from "./gpuMemoryManager";
export * as renderManager from "./renderManager";
export * as pickManager from "./pickManager";
export * as meshManager from "./meshManager";

export * from "./ViewManager";
export * from "./ViewRenderState";
export * from "./RenderBuffers";
export * from "./RenderContext";
export * from "./RENDER_PASSES";

export * from "./MemoryView";
export * from "./ShaderView";
export * from "./MemoryDebugger";
export * from "./ShaderDebugger";
export * from "./ViewManager";

// export * from "./gpuMemoryManager/dataTextures/index";
