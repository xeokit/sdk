import type {DataModel} from "../../../model/data";
import type {SceneModel} from "../../../model/scene";
import type {XGFChunkManifest} from "./XGFChunkManifest";

/**
 * Parameters for loading one XGF stream chunk.
 */
export interface XGFChunkLoadParams {
  /** Manifest describing the chunk being loaded. */
  manifest: XGFChunkManifest;
  /** Optional XGF bytes for the chunk. When omitted, load options must provide them. */
  fileData?: ArrayBuffer;
  /** SceneModel that receives the loaded chunk content. */
  sceneModel: SceneModel;
  /** Optional DataModel paired with the SceneModel. */
  dataModel?: DataModel;
}
