import {SceneModel} from "@xeokit/scene";
import {DataModel} from "@xeokit/data";
import {inflateXKT} from "./inflateXKT";
import {unpackXKT} from "./unpackXKT";
import {xktToModel} from "./xktToModel";

/**
 * Loads XKT file data from an ArrayBuffer into a {@link @xeokit/scene!SceneModel | SceneModel}
 * and (optionally) a {@link @xeokit/data!DataModel | DataModel}.
 *
 * * Expects {@link @xeokit/scene!SceneModel.built | SceneModel.built} and
 * {@link @xeokit/scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 * * Expects {@link @xeokit/data!DataModel.built | DataModel.built} and
 * {@link @xeokit/data!DataModel.destroyed | DataModel.destroyed} to be ````false````
 *
 * See {@link @xeokit/xkt} for usage.
 *
 * See {@link XKTData} for insights into the structure of an XKT file.
 *
 * @param params - Loading parameters.
 * @param params.data - XKT file data
 * @param params.sceneModel - SceneModel to load into.
 * @param params.dataModel - DataModel to load into.
 * @returns {Promise} Resolves when XKT has been loaded.
 */
export function loadXKT(params: {
    data: ArrayBuffer,
    sceneModel: SceneModel,
    dataModel?: DataModel,
    log?: Function
}): Promise<any> {
    return new Promise<void>(function (resolve, reject) {
        if (!params.data) {
            reject("Argument expected: data");
            return;
        }
        if (!params.sceneModel) {
            reject("Argument expected: sceneModel");
            return;
        }
        xktToModel({
            xktData: inflateXKT(unpackXKT(params.data)),
            sceneModel: params.sceneModel,
            dataModel: params.dataModel
        });
        resolve();
    });
}
