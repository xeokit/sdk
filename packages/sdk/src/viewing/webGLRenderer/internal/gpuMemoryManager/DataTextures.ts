import { type BatchDataTextures } from "./BatchDataTextures";
import { DataTexture } from "./dataTextures/DataTexture";
import { EventEmitter } from "../../../../base/core";
import {MatrixTexture} from "./dataTextures/MatrixTexture";

/**
 * Collection of GPU data textures used by a {@link WebGLRenderer}.
 *
 * {@link DataTextures} centralizes all GPU-resident data required for rendering,
 * including:
 * - Global, view-dependent textures shared across all render batches
 * - Per-batch textures used for sorted, efficient draw submission
 *
 * This object represents the renderer’s authoritative view of GPU-side data.
 *
 * @internal
 */
export interface DataTextures {

  /**
   * Total number of RTC rendering tiles that currently exist.
   */
  numTiles: number;

  /**
   * Per-view tile camera matrix tables.
   *
   * For each View, this array contains a {@link DataTexture} holding the
   * RTC camera view matrices for that View in all tiles.
   *
   * These textures are global and shared across all render batches.
   */
  viewTileCameraMatrixTexture: MatrixTexture[];

  /**
   * Per-view tile ray-picking matrix tables.
   *
   * For each View, this array contains a {@link DataTexture} holding the
   * RTC matrices used for ray picking against tiles that View in all tiles.
   *
   * These textures are global and shared across all render batches.
   */
  viewTilePickMatrixTexture: MatrixTexture[];

  /**
   * Render batches for sorted rendering.
   *
   * The renderer groups renderable meshes into batches that share compatible
   * rendering state in order to minimize draw calls. Each batch owns a set
   * of {@link DataTexture}s containing all GPU-resident data needed to draw
   * the meshes in that batch.
   *
   * Each batch is drawn independently, with one draw call per render pass.
   */
  batches: BatchDataTextures[];

  /**
   * Event emitted when a new render batch is created.
   *
   * This event is fired after the batch has been initialized and added to
   * {@link batches}. Listeners may use it to attach debugging tools, statistics
   * collectors, or other batch-level observers.
   */
  onBatchCreated: EventEmitter<DataTextures, undefined>;
}
