import {unpackXGF} from "./unpackXGF";
import {SceneModel} from "../../../scene";
import {xgfToModel} from "./xgfToModel";
import {DataModel} from "../../../data";

/**
 * @private
 */
export function parse(params: {
    fileData: any;
    sceneModel?: SceneModel;
    dataModel?: DataModel;
}): Promise<void> {
    return new Promise<void>(function (resolve, reject) {
        const {fileData, sceneModel, dataModel} = params;
        xgfToModel({
            xgfData: unpackXGF(fileData),
            sceneModel,
            dataModel
        });
        resolve();
    });
}
