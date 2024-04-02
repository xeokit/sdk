import {SceneModelStreamLayerParams} from "./SceneModelStreamLayerParams";

/**
 * Indicates what renderer resources will need to be allocated in a {@link @xeokit/viewer!Viewer | Viewer's}
 * {@link @xeokit/viewer!Renderer | Renderer} to support progressive loading for a {@link @xeokit/scene!SceneModel | SceneModel}.
 *
 * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
 */
export interface SceneModelStreamParams {

    /**
     * Indicates what renderer layers will need to be allocated.
     */
    streamLayers: SceneModelStreamLayerParams[];
}


