import type {SceneModel} from "../../../model/scene";

/**
 * Parameters for unloading one previously-loaded XGF stream chunk.
 */
export interface XGFChunkUnloadParams {
  /** SceneModel that currently owns the loaded chunk. */
  sceneModel: SceneModel;
  /** Stable ID of the chunk to unload. */
  chunkId: string;
}
