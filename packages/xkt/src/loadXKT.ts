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
 * @throws {Error} If the SceneModel has already been destroyed.
 * @throws {Error} If the SceneModel has already been built.
 * @throws {Error} If the DataModel has already been destroyed.
 * @throws {Error} If the DataModel has already been built.
 */
export function loadXKT(params: {
    data: ArrayBuffer,
    sceneModel: SceneModel,
    dataModel?: DataModel,
    log?: Function
}): Promise<any> {
    if (!params.data) {
        throw new Error("Argument missing: data");
    }
    if (!params.sceneModel) {
        throw new Error("Argument missing: sceneModel");
    }
    if (params.sceneModel.destroyed) {
        throw new Error("SceneModel already destroyed");
    }
    if (params.sceneModel.built) {
        throw new Error("SceneModel already built");
    }
    if (params.dataModel) {
        if (params.dataModel.destroyed) {
            throw new Error("DataModel already destroyed");
        }
        if (params.dataModel.built) {
            throw new Error("DataModel already built");
        }
    }
    return new Promise<void>(function (resolve, reject) {
        xktToModel({
            xktData: inflateXKT(unpackXKT(params.data)),
            sceneModel: params.sceneModel,
            dataModel: params.dataModel
        });
        resolve();
    });
}
