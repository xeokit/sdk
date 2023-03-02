import {LoadParams} from "@xeokit/core/components";
import {inflateXKT} from "./inflateXKT";
import {unpackXKT} from "./unpackXKT";
import {xktToModel} from "./xktToModel";

/**
 * Loads XKT file data from an ArrayBuffer into a {@link @xeokit/scene!SceneModel | SceneModel}
 * and (optionally) a {@link @xeokit/data!DataModel | DataModel}.
 *
 * * Expects {@link @xeokit/scene!SceneModel.built | SceneModel.built} and
 * {@link @xeokit/scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 * * Does not call {@link @xeokit/scene!SceneModel.build | SceneModel.build} - we call that ourselves,
 * when we have finished building the SceneModel.
 *
 * See {@link @xeokit/xkt} for usage.
 *
 * See {@link XKTData} for insights into the structure of an XKT file.
 *
 * @param {LoadParams} params Loading parameters.
 * @returns {Promise} Resolves when XKT has been loaded.
 */
export function loadXKT(params: LoadParams): Promise<any> {
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
