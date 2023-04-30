import type { DataModel } from "@xeokit/data";
import type { SceneModel } from "@xeokit/scene";
import type { XKTData } from "./XKTData";
/**
 * @private
 */
export declare function xktToModel(params: {
    xktData: XKTData;
    sceneModel: SceneModel;
    dataModel?: DataModel;
}): void;
