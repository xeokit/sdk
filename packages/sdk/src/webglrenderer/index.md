# General Architecture

## Core Components

- **RenderContext**: Acts as the central hub for rendering operations. It manages the WebGL context, global rendering state, and communication between components.
- **WebGLRenderer**: The main entry point for the rendering system. It initializes and coordinates the `RenderContext` and `ViewManager`.

## View Management

- **ViewManager**: Manages multiple views in the renderer. It handles the lifecycle of `RendererView` instances and coordinates rendering and clearing operations for views.
- **RendererView**: Represents a single view. It manages rendering, picking, and state for a specific view, interacting with the `RenderManager` and `PickManager`.

## Rendering Pipeline

- **RenderManager**: Handles the rendering pipeline, including drawing operations. It uses data from the `MeshManager` and GPU memory to render scenes.
- **RenderBuffers**: Manages framebuffers and other rendering buffers for each view.

## Picking System

- **PickManager**: Handles object picking (e.g., selecting objects in the scene). It uses GPU memory to determine which objects are under the cursor.

## GPU Memory Management

- **GPUMemoryManager**: Manages GPU memory for geometries, textures, and other resources. It provides interfaces for editing (`GPUMemoryEditor`) and reading (`GPUMemoryReader`) GPU memory.

## Mesh and Object Management

- **MeshManager**: Manages mesh data and their visual states (e.g., visibility, highlighting). It interfaces with the `GPUMemoryManager` to upload and update mesh data.
- **RendererObject** and **RendererMesh**: Represent objects and meshes in the scene, providing interfaces for managing their rendering states.

## Scene Representation

- **SceneMesh** and **SceneGeometry**: Represent the logical structure of meshes and their geometries. They serve as the data source for rendering operations.

---

# Workflow

## Initialization

- The `WebGLRenderer` initializes the `RenderContext` and `ViewManager`.
- Views are created and managed by the `ViewManager`.

## Rendering

- The `RenderManager` uses data from the `MeshManager` and GPU memory to render the scene.
- Each `RendererView` coordinates rendering for its associated view.

## Picking

- The `PickManager` performs object picking by analyzing GPU memory data.

## GPU Memory Management

- The `GPUMemoryManager` handles allocation, updates, and reading of GPU resources.

## Destruction

- All components clean up their resources when destroyed, ensuring efficient memory management.

---

This modular design ensures separation of concerns, making the system maintainable, scalable, and easy to exten