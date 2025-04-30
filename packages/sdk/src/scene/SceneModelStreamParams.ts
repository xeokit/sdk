import { SceneModelStreamLayerParams } from "./SceneModelStreamLayerParams";

/**
 * Indicates what renderer resources will need to be allocated in a {@link viewer!Viewer | Viewer's}
 * {@link viewer!Renderer | Renderer} to support progressive loading for a {@link SceneModel | SceneModel}.
 *
 * See {@link scene | @xeokit/sdk/scene}   for usage.
 */
export interface SceneModelStreamParams {

  /**
     * Indicates what renderer layers will need to be allocated.
     */
  streamLayers: SceneModelStreamLayerParams[];
}


