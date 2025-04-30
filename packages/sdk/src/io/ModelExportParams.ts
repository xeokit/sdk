import { SceneModel } from "../scene";
import { DataModel } from "../data";

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
