import type {DataModel} from "../data/DataModel";
import type {SceneModel} from "../scene/SceneModel";

/**
 * Parameters for {@link ModelEncoder | ModelEncoder}.
 *
 * @internal
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
