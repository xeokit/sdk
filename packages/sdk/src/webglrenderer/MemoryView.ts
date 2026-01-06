import type { DataTextures } from "./viewManager/gpuMemoryManager/DataTextures";
import type { SceneGeometry, SceneMesh } from "../scene";
import type { View } from "../viewer";

/**
 * Read-only view of GPU-related memory owned by a {@link WebGLRenderer}.
 * Provides structured, immutable access to the renderer’s GPU-resident data for inspection and debugging.
 */
export interface MemoryView {

  /** GPU data textures used by the renderer (read-only).
   */
  dataTextures: DataTextures;

  /**
   * Gets the {@link View} registered at the specified index.
   * @param viewIndex Index of the view.
   * @returns The {@link View} instance or `null` if not found.
   */
  getViewAtIndex(viewIndex: number): View | null;

  /**
   * Gets the {@link SceneMesh} registered at the specified batch and mesh indices.
   * @param batchIndex Index of the render batch.
   * @param meshIndex Index of the mesh within the batch.
   * @returns The {@link SceneMesh} instance or `null` if not found.
   */
  getMeshAtIndex(batchIndex: number, meshIndex: number): SceneMesh | null;

  /**
   * Gets the {@link SceneGeometry} registered at the specified batch and geometry indices.
   * @param batchIndex Index of the render batch.
   * @param geometryIndex Index of the geometry within the batch.
   * @returns The {@link SceneGeometry} instance or `null` if not found.
   */
  getGeometryAtIndex(batchIndex: number, geometryIndex: number): SceneGeometry | null;
}
