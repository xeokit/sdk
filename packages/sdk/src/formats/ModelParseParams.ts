import type {DataModel} from "../model/data/DataModel";
import type {SceneModel} from "../model/scene/SceneModel";

/**
 * Parameters for {@link ModelParser}.
 *
 * @internal
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
