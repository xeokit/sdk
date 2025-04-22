import {SceneModel} from "../scene";
import {DataModel} from "../data";

/**
 * Parameters for {@link ModelEncoder.encode | ModelEncoder.encode}.
 */
export interface ModelEncodeParams {

    /**
     * The SceneModel providing geometry to encode.
     */
    sceneModel?: SceneModel;

    /**
     * The DataModel providing semantic data to encode.
     */
    dataModel?: DataModel;
}
