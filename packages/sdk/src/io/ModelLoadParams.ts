import {SceneModel} from "../scene/SceneModel";
import {DataModel} from "../data/DataModel";

/**
 * Parameters for {@link ModelLoader.load | ModelLoader.load}.
 */
export interface ModelLoadParams {

  /**
   * Path to load file data from.
   */
  filePath?: string,

  /**
   * The file data to load.
   */
  fileData?: any,

  /**
   * The SceneModel to load geometry into.
   */
  sceneModel?: SceneModel,

  /**
   * The DataModel to load semantic data into.
   */
  dataModel?: DataModel
}
