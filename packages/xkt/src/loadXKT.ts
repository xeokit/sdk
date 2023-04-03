import {SceneModel} from "@xeokit/scene";
import {DataModel} from "@xeokit/data";
import {inflateXKT} from "./inflateXKT";
import {unpackXKT} from "./unpackXKT";
import {xktToModel} from "./xktToModel";

/**
 * Imports XKT file data from an ArrayBuffer into a {@link @xeokit/scene!SceneModel | SceneModel}
 * and/or a {@link @xeokit/data!DataModel | DataModel}.
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
 * @returns {@link @xeokit/core/components!SDKError} If the SceneModel has already been destroyed.
 * @returns {@link @xeokit/core/components!SDKError} If the SceneModel has already been built.
 * @returns {@link @xeokit/core/components!SDKError} If the DataModel has already been destroyed.
 * @returns {@link @xeokit/core/components!SDKError} If the DataModel has already been built.
 */
export function loadXKT(params: {
    data: ArrayBuffer,
    sceneModel?: SceneModel,
    dataModel?: DataModel,
    log?: Function
}): Promise<any> {
    const sceneModel = params.sceneModel
    const dataModel = params.dataModel;
    if (sceneModel?.destroyed) {
        throw new Error("SceneModel already destroyed");
    }
    if (sceneModel?.built) {
        throw new Error("SceneModel already built");
    }
    if (dataModel?.destroyed) {
        throw new Error("DataModel already destroyed");
    }
    if (dataModel?.built) {
        throw new Error("DataModel already built");
    }
    return new Promise<void>(function (resolve, reject) {
        xktToModel({
            xktData: inflateXKT(unpackXKT(params.data)),
            sceneModel,
            dataModel
        });
        resolve();
    });
}
