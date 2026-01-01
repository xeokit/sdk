import {type DataTexturesBatch} from "./DataTexturesBatch";
import {DataTexture} from "./dtx/DataTexture";
import {EventEmitter} from "../../../core";

/**
 * GPU-resident data textures used internally within a WebGLRenderer.
 * These data textures are exposed as read-only resources for debugging tools to inspect.
 */
export interface DataTextures {

  /**
   * For each View, a DataTexture containing a table of RTC view matrices for the tiles in that view.
   */
  tileViewMatrices: DataTexture[];

  /**
   * For each View, a DataTexture containing a table of RTC ray pick matrices for the tiles in that view.
   */
  tileRayPickMatrices: DataTexture[];

  /**
   * Batches of data textures for sorted rendering.
   *
   * These are indexed using {@link GPUMemoryBatch.batchIndex | GPUMemoryBatch.batchIndex}.
   */
  batches: DataTexturesBatch[];

  /**
   * Event fired when a new batch is created.
   */
  onBatchCreated : EventEmitter<DataTextures, undefined>;
}

