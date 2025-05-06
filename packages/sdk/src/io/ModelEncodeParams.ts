import type {DataModel} from "../data";
import type {SceneModel} from "../scene";

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
