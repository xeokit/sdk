import type { XKTData } from "./XKTData";
import type { SceneModel } from "@xeokit/scene";
import type { DataModel } from "@xeokit/data";
/**
 * @private
 */
export declare function modelToXKT(params: {
    sceneModel: SceneModel;
    dataModel?: DataModel;
}): XKTData;
