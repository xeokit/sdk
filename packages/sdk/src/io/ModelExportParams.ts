import { DataModel } from "../data";
import { SceneModel } from "../scene";

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
