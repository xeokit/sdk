
/**
 * # Mesh Manager for WebGL Renderer
 *
 * This module provides batching and management of 3D mesh objects for the xeokit WebGL renderer.
 *
 * @remarks
 * - The {@link MeshManager} is responsible for grouping meshes into batches for efficient GPU upload and rendering.
 * - Meshes are organized by primitive type and managed in batches to minimize draw calls and optimize memory usage.
 * - The manager coordinates with {@link GPUMemoryManager} to allocate, update, and release GPU memory for mesh data.
 * - Mesh handles and batch handles provide references for updating mesh attributes, visibility, and rendering state.
 * - Used internally by the renderer; not typically accessed directly by application code.
 *
 * ## Key Classes
 * - {@link MeshManager}: Main batching and management class for meshes.
 * - {@link MeshBatch}: Interface for a batch of meshes with the same primitive type.
 * - {@link MeshBatchMeshHandle}: Handle for referencing a mesh within a batch.
 * - {@link RendererMesh}, {@link RendererGeometry}, {@link RendererTexture}, {@link RendererMaterial}: Internal representations of mesh, geometry, and texture data.
 *
 * @module meshManager
 * @internal
 */
export * from "./MeshManager";
export * from "./MeshBatch";
export * from "./MeshBatchImpl";
export * from "./MeshBatchMeshHandle";
export * from "./RendererObject"
export * from "./RendererMesh";
export * from "./RendererGeometry";
export * from "./RendererTexture";
export * from "./RendererMaterial";
