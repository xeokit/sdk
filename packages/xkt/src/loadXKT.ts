import {SDKError} from "@xeokit/core";
import type {SceneModel} from "@xeokit/scene";
import type {DataModel} from "@xeokit/data";
import {inflateXKT} from "./inflateXKT";
import {unpackXKT} from "./unpackXKT";
import {xktToModel} from "./xktToModel";

/**
 * Imports [XKT](/docs/pages/GLOSSARY.html#xkt) file data from an ArrayBuffer into a {@link @xeokit/scene!SceneModel | SceneModel}
 * and/or a {@link @xeokit/data!DataModel | DataModel}.
 *
 * * Expects {@link @xeokit/scene!SceneModel.built | SceneModel.built} and
 * {@link @xeokit/scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 * * Expects {@link @xeokit/data!DataModel.built | DataModel.built} and
 * {@link @xeokit/data!DataModel.destroyed | DataModel.destroyed} to be ````false````
 *
 * See {@link "@xeokit/xkt"} for usage.
 *
 * See {@link @xeokit/xkt!XKTData} for insights into the structure of an [XKT](/docs/pages/GLOSSARY.html#xkt) file.
 *
 * @param params - Loading parameters.
 * @param params.fileData - [XKT](/docs/pages/GLOSSARY.html#xkt) file data
 * @param params.sceneModel - SceneModel to load into.
 * @param params.dataModel - Optional DataModel to load into.
 * @returns {Promise} Resolves when [XKT](/docs/pages/GLOSSARY.html#xkt) has been loaded.
 * @throws *{@link @xeokit/core!SDKError}*
 * * If the SceneModel has already been destroyed.
 * * If the SceneModel has already been built.
 * * If the DataModel has already been destroyed.
 * * If the DataModel has already been built.
 */
export function loadXKT(params: {
    fileData: ArrayBuffer;
    sceneModel: SceneModel;
    dataModel?: DataModel;
}): Promise<void> {
    const {fileData, sceneModel, dataModel} = params;
    if (sceneModel.destroyed) {
        return Promise.reject(new SDKError("SceneModel already destroyed"));
    }
    if (sceneModel.built) {
        return Promise.reject(new SDKError("SceneModel already built"));
    }
    if (dataModel) {
        if (dataModel.destroyed) {
            return Promise.reject(new SDKError("DataModel already destroyed"));
        }
        if (dataModel.built) {
            return Promise.reject(new SDKError("DataModel already built"));
        }
    }
    xktToModel({
        xktData: inflateXKT(unpackXKT(fileData)),
        sceneModel,
        dataModel,
    });
    return Promise.resolve();
}