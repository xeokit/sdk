import {SceneModel} from "../scene";
import {DataModel} from "../data";

/**
 *
 */
export interface ExportParams {
    sceneModel?: SceneModel;
    dataModel?: DataModel;
    version?: string;
}
