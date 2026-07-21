import type {DataModel} from "../../../model/data";
import type {SceneModel} from "../../../model/scene";
import type {XGFChunkManifest} from "./XGFChunkManifest";

/**
 * Parameters for loading multiple XGF stream chunks.
 */
export interface XGFChunksLoadParams {
  /** Manifests for the chunks requested by the caller. */
  manifests: XGFChunkManifest[];
  /** SceneModel that receives the loaded chunk content. */
  sceneModel: SceneModel;
  /** Optional DataModel paired with the SceneModel. */
  dataModel?: DataModel;
}
