import type { DataModel } from "../data";
import type { SceneModel } from "../scene";

/**
 * Parameters for {@link ModelLoader.load | ModelLoader.load}.
 */
export interface ModelLoadParams {

  /**
     * The file data to load.
     */
  fileData: any,

  /**
     * The SceneModel to load geometry into.
     */
  sceneModel?: SceneModel,

  /**
     * The DataModel to load semantic data into.
     */
  dataModel?: DataModel
}
