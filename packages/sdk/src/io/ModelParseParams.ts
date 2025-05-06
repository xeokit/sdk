import type {DataModel} from "../data";
import type {SceneModel} from "../scene";

/**
 * Parameters for {@link ModelParser}.
 */
export interface ModelParseParams {

  /**
   * File data to parse.
   */
  fileData: any,

  /**
   * SceneModel to parse geometry into.
   */
  sceneModel?: SceneModel,

  /**
   * DataModel to parse semantic data into.
   */
  dataModel?: DataModel,

  /**
   * Callback to receive logging messages from the parser.
   */
  log?: any
}
