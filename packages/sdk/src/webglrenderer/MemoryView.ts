import { type DataTextures } from "./viewManager/gpuMemoryManager/DataTextures";

/**
 * Read-only view of GPU-related memory owned by a {@link WebGLRenderer}.
 *
 * {@link MemoryView} exposes structured, immutable access to the renderer’s
 * GPU-resident data for inspection, debugging, or tooling purposes.
 *
 * It does not provide mutation APIs; all updates to the underlying data are
 * performed internally by the renderer and its memory managers.
 */
export interface MemoryView {

  /**
   * GPU data textures used by the renderer.
   *
   * Provides access to the full {@link DataTextures} collection, including:
   * - Global, view-dependent textures shared across batches
   * - Per-batch textures used for sorted rendering
   *
   * The returned object should be treated as read-only and is intended for
   * diagnostics, debugging UIs, and analysis tools.
   */
  dataTextures: DataTextures;
}
