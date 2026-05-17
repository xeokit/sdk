import type {DataModel} from "../model/data/DataModel";
import type {SceneModel} from "../model/scene/SceneModel";

/**
 * Parameters for {@link ModelExporter.write | ModelExporter.write}.
 */
export interface ModelExportParams {

  /**
   * The SceneModel to export.
   */
  sceneModel?: SceneModel;

  /**
   * The DataModel to export.
   */
  dataModel?: DataModel;

  /**
   * The schema version to export.
   */
  version?: string;
}
