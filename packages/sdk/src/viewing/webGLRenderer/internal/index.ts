/**
 * <img
 *   style="padding-top:20px; padding-bottom:30px; height:100px;"
 *   src="../../assets/xeokit_webgl_logo.svg"
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
 * ├── MemoryConfigs -- GPU memory budgeting configs
 * ├── WebGLRendererEvents -- Renderer lifecycle and error events
 * └── internal
 *     ├── ViewManager -- Internal coordinator for per-View rendering
 *     ├── MeshManager -- Manages mesh batching and renderer-side representations
 *     ├── GPUMemoryManager -- Manages GPU-resident memory
 *     ├── RenderManager -- Executes the render pipeline
 *     ├── PickManager -- Manages GPU picking
 *     ├── DrawOps -- Low-level WebGL draw infrastructure
 *     └── inspectors -- Diagnostics and runtime inspection utilities
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
 * <br><br>
 *
 * ```mermaid
 * classDiagram
 *     Scene *--> SceneEvents : emits
 *     Viewer --> SceneEvents : subscribes
 *     Viewer *--> ViewerEvents : emits
 *     WebGLRenderer --> ViewerEvents : subscribes
 *     WebGLRenderer:memoryConfigs
 *     WebGLRenderer:memoryUsage
 *     WebGLRenderer:memoryInspector
 *     WebGLRenderer:shaderInspector
 *     WebGLRenderer:renderInspector
 *     WebGLRenderer:events
 *     WebGLRenderer:viewer
 *     Viewer:scene
 *     Viewer o--> Scene: attached
 *     WebGLRenderer o--> Viewer: attached
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
 * - Owns the complete rendering pipeline for a {@link viewing!viewer.Viewer | Viewer}.
 * - Observes {@link model!scene.Scene | Scene} and {@link viewing!viewer.Viewer | Viewer} lifecycle events.
 * - Exposes diagnostics and memory inspection APIs:
 *   - {@link MemoryUsage} -- high-level GPU memory statistics
 *   - {@link MemoryInspector} -- inspects contents of {@link DataTextures}
 *   - {@link ShaderInspector} -- inspects shaders, source code etc.
 * - Emits lifecycle events via {@link WebGLRendererEvents}.
 * - Owns exactly one internal {@link ViewManager}.
 *
 * ---
 *
 * ### ViewManager (internal)
 *
 * - {@link ViewManager}
 * - Central coordinator for all per-{@link viewing!viewer.View | View} rendering.
 * - Manages the lifecycle of {@link viewing!viewer.View | View} instances owned by a {@link viewing!viewer.Viewer | Viewer}.
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
 * - Executes the render pipeline for the active {@link viewing!viewer.View | View}.
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
 * ---
 *
 * <br>
 *
 * ## Inspection APIs (Diagnostics)
 *
 * The WebGLRenderer provides **read-only diagnostics APIs** for inspecting all GPU-resident renderer state.
 * These APIs are intended for debugging, profiling, and validation by xeokit developers, and are not part of
 * the public API surface.
 *
 * <br>
 *
 *
 * ### Memory Inspection
 *
 * - {@link MemoryUsage} via {@link WebGLRenderer.getMemoryUsage}
 *   - Returns high-level GPU memory statistics: allocated and used memory in MB/KB.
 *   - Example:
 *     ```ts
 *     const usage = webglRenderer.getMemoryUsage();
 *     console.log(`GPU: ${usage.usedMB} MB used of ${usage.allocatedMB} MB allocated`);
 *     ```
 *
 * - {@link MemoryInspector} via {@link WebGLRenderer.getMemoryInspector}
 *   - Provides a structured, read-only view of all GPU-resident data textures and their contents.
 *   - Allows mapping between GPU indices and scene objects/geometries.
 *   - Example:
 *     ```ts
 *     const inspector = webglRenderer.getMemoryInspector();
 *     const mesh = inspector.getMeshAtIndex(batchIndex, meshIndex);
 *     const geometry = inspector.getGeometryAtIndex(batchIndex, geometryIndex);
 *     const dataTextures = inspector.dataTextures;
 *     ```
 *   - See {@link inspectors/MemoryInspector} for a detailed usage example.
 *
 * ---
 *
 * ### Shader Inspection
 *
 * The WebGLRenderer exposes **read-only APIs** for inspecting the generated WebGL shader programs and techniques.
 *
 * - {@link ShaderInspector} via {@link WebGLRenderer.getShaderInspector}
 *   - Provides structured access to all shader source code used by the renderer, organized by primitive type and render pass.
 *   - Example:
 *     ```ts
 *     const shaderInspector = webglRenderer.getShaderInspector();
 *     const src = shaderInspector.techniques.triangles.opaque.vertexShaderSrc;
 *     console.log("Opaque triangles vertex shader:", src);
 *     ```
 *   - See {@link inspectors/ShaderInspector} for details.
 *
 * ---
 *
 * ### Draw List Inspection
 *
 * The WebGLRenderer includes a **Draw List Inspector** for logging and analyzing all draw calls issued during rendering.
 *
 * - {@link RenderInspector} via {@link WebGLRenderer.getRenderInspector}
 *   - Captures detailed information about each rendered frame, including draw calls, primitive types, shader techniques, batch and pass details, and timing.
 *   - Provides per-frame logs and frame rate statistics for each view.
 *   - Example:
 *     ```ts
 *     const renderInspector = webglRenderer.getRenderInspector();
 *     renderInspector.enabled = true;
 *     // After rendering:
 *     const frameLog = renderInspector.frameLogs[viewIndex];
 *     console.log(JSON.stringify(frameLog, null, 2));
 *     ```
 *   - See {@link inspectors/RenderInspector} and related types for log structure.
 *
 * ---
 *
 * <br>
 *
 * ## Execution Workflows
 *
 * The following selected workflows help illustrate how the core components interact
 * during key operations.
 *
 * <br>
 *
 * ### Viewer Attached to WebGLRenderer
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
 * ### SceneGeometry Creation
 *
 * Whenever geometries are created, they get pre-loaded into the renderer.
 *
 * 1. A **SceneGeometry** is created in the **Scene**.
 * 2. **WebGLRenderer** is notified via **SceneEvents.onGeometryCreated**.
 * 3. **ViewManager.sceneGeometryCreated(sceneGeometry)**
 * 4. **MeshManager.sceneGeometryCreated(sceneGeometry)**
 * 5. **MeshManager** creates a **RendererGeometry** instance for the **SceneGeometry**.
 * 6. **RendererGeometry** requests GPU memory allocation: **GPUMemoryManager.createGeometryBuffers()**
 * 7. **GPUMemoryManager** allocates buffers and uploads geometry data.
 * 8. **RendererGeometry** is ready for use by subsequently-created **RendererMesh** instances.
 *
 * ---
 *
 * ### SceneMesh Creation
 *
 * Whenever meshes are created, they get loaded into the renderer, and are attached
 * to **RendererMesh** instances.
 *
 * TODO: Describe the role of RTC tiles here.
 *
 * 1. A **SceneMesh** is created in the **Scene**.
 * 2. **WebGLRenderer** is notified via **SceneEvents.onSceneMeshCreated**.
 * 3. **ViewManager.sceneMeshCreated(sceneMesh)**
 * 4. **MeshManager.sceneMeshCreated(sceneMesh)**
 * 5. **MeshManager** creates a **RendererMesh** instance for the **SceneMesh**.
 * 5. **MeshManager** requests GPU memory allocation: **GPUMemoryManager.createBatch()**
 * 6. **GPUMemoryManager** allocates buffers and uploads geometry data.
 * 7. **MeshManager** adds **RendererMesh** to **MeshBatch**.
 * 8. **RendererMesh** is ready for use by any subsequently-created **RendererObject**.
 *
 * ---
 *
 * ### SceneObject Creation
 *
 * Whenever SceneObjects are created, they automatically get loaded into the Viewer and the WebGLRenderer.
 *
 * 1. A **SceneObject** is created in the **Scene**.
 * 2. **Viewer** is notified via **SceneEvents.onSceneObjectCreated**.
 * 3. The **Viewer** creates a **ViewObject** in each existing **View** for the **SceneObject**.
 * 4. **WebGLRenderer** is also notified via **SceneEvents.onSceneObjectCreated**.
 * 5. **ViewManager.sceneObjectCreated(sceneObject)**
 * 6. **MeshManager.sceneObjectCreated(sceneObject)**
 * 7. **MeshManager** finds pre-created **RendererMesh** instances for each of the SceneObject's SceneMeshes (see SceneMesh Creation).
 * 8. **MeshManager** creates a **RendererObject** and links it to the **RendererMesh** instances.
 * 9. On the next render, the new object will appear in the view.
 *
 * ---
 *
 * ### SceneObject Deletion
 *
 * Whenever SceneObjects are deleted, they get automatically get unloaded from the Viewer and the WebGLRenderer. The **RendererMesh** and
 * **RendererObject** instances are not unloaded immediately, but are instead kept in memory
 * for potential reuse. This is actually a useful way to cache content for any objects
 * that repeatedly get created and destroyed.
 *
 * 1. A **SceneObject** is destroyed.
 * 2. **Viewer** is notified via **SceneEvents.onSceneObjectDestroyed**.
 * 3. The **Viewer** destroys the corresponding **ViewObject**.
 * 4. **WebGLRenderer** is notified of deletion.
 * 5. **ViewManager.sceneObjectDestroyed(sceneObject)**
 * 6. **MeshManager.sceneObjectDestroyed(sceneObject)**
 * 7. **MeshManager** destroys corresponding **RendererObject**.
 * 8. **MeshManager** notifies **GPUMemoryManager** to release GPU memory.
 * 9. **GPUMemoryManager** releases GPU memory used by the object.
 * 10. On the next render, the object will no longer appear in the view.
 *
 * ---
 *
 * ### ViewObject Visibility Change
 *
 * Whenever a ViewObject's visibility is changed, the renderer updates
 * the visibility state in GPU memory, so that only visible objects
 * are rendered.
 *
 * 1. The visibility of a **ViewObject** is changed in a **View**.
 * 2. **WebGLRenderer** is notified via **ViewEvents.onViewObjectVisibilityChanged**.
 * 3. **ViewManager.viewObjectVisibilityChanged(viewObject)**
 * 4. **MeshManager.viewObjectVisibilityChanged(viewObject)**
 * 5. **MeshManager** marks the **RendererObject** as visible/invisible, which updates
 * the visibility states of its **RendererMesh** instances, which each their visibility states to **GPUMemoryManager**.
 * 7. On next render, the object will be rendered or skipped based on its visibility.
 *
 * ---
 *
 * ### SceneMesh Matrix Update
 *
 * Whenever a SceneMesh's matrix is updated, the renderer updates
 * the matrix data in GPU memory.
 *
 * TODO: Describe the role of RTC tiles here, and how matrix updates interact with RTC tile assignments.
 *
 * 1. The matrix of a **SceneMesh** is updated in the **Scene**.
 * 2. **WebGLRenderer** is notified via **SceneEvents.onSceneMeshMatrixUpdated**.
 * 3. **ViewManager.sceneMeshMatrixChanged(sceneMesh)**
 * 4. **MeshManager.sceneMeshMatrixChanged(sceneMesh)**
 * 5. **MeshManager** updates matrix data in **GPUMemoryManager**.
 * 6. **GPUMemoryManager** uploads updated matrix to GPU.
 * 7. On next render, the mesh will be transformed using the updated matrix.
 *
 * ---
 *
 * ### SceneMesh Color Update
 *
 * Whenever a SceneMesh's color is updated, the renderer updates
 * the color data in GPU memory.
 *
 * 1. The color of a **SceneMesh** is updated in the **Scene**.
 * 2. **WebGLRenderer** is notified via **SceneEvents.onSceneMeshColorUpdated**.
 * 3. **ViewManager.sceneMeshColorChanged(sceneMesh)**
 * 4. **MeshManager.sceneMeshColorChanged(sceneMesh)**
 * 5. **MeshManager** updates color data in **GPUMemoryManager**.
 * 6. **GPUMemoryManager** uploads updated color to GPU.
 * 7. On next render, the mesh will be rendered using the updated color.
 *
 * ---
 *
 * ### View Updated
 *
 * When a View signals that it's been updated, the renderer
 * re-renders the View. All the minor updates that have happened
 * (such as object visibility changes, matrix updates, color updates etc)
 * are already reflected in GPU memory, so the renderer can just
 * go ahead and render the current state.
 *
 * 1. A **View** signals that it's "updated", meaning that it has a batch of minor updates to render.
 * 2. **WebGLRenderer** is notified via **ViewerEvents.onViewUpdated**.
 * 3. **ViewManager** initiates render via **RenderManager.render**.
 * 4. **RenderManager** retrieves visible **RendererObjects** from **MeshManager**.
 * 5. **RenderManager** sets up render passes and state.
 * 6. **RenderManager** issues draw calls using **DrawOps** for each visible **RendererObject**.
 * 7. Frame is rendered to the canvas.
 *
 * ---
 *
 * ### Picking Operation (WIP)
 *
 * When a user initiates a picking operation (e.g., clicking on the canvas),
 * the renderer performs GPU-based picking to identify the selected object.
 *
 * *The rationale for implementing picking via the WebGLRenderer API, and not via the Viewer API (which would really be
 * semantically nicer), is because we need the renderer's GPU resources to perform picking, and we don't want to do it
 * using the renderer **through** the Viewer (like a facade), because the Viewer needs to remain agnostic of
 * the renderer.*
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
 * ---
 *
 * @module internal
 * @internal
 */


import type {MeshManager, RendererObject, RendererMesh, MeshBatchImpl} from "./meshManager";
import type {WebGLRenderer} from "../WebGLRenderer";
import type {DrawTechnique, DrawOps,  RenderPassDrawOps, DrawOp, getDrawOps, putDrawOps} from "./drawOps";
import type { Viewer, View, ViewObject} from "../../viewer";
import type {Scene, SceneObject, SceneMesh, SceneGeometry} from "../../../model/scene";
import {type GPUMemoryManager} from "./gpuMemoryManager";
import {type RenderManager} from "./renderManager";
import {type PickManager} from "./pickManager";
import type {MemoryInspector, RenderInspector, ShaderInspector} from "./inspectors";

export * as drawOps from "./drawOps";
export * as gpuMemoryManager from "./gpuMemoryManager";
export * as renderManager from "./renderManager";
export * as pickManager from "./pickManager";
export * as meshManager from "./meshManager";
export * as inspectors from "./inspectors";
export * as snapManager from "./snapManager";

export * from "./ViewManager";
export * from "./ViewRenderState";
export * from "./RenderBuffers";
export * from "./RenderContext";
export * from "./RENDER_PASSES";
export * from "./RENDER_BINS";
