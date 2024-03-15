import {SDKError} from "@xeokit/core";
import type {SceneModel} from "@xeokit/scene";
import type {DataModel} from "@xeokit/data";
import {inflateDTX} from "./inflateDTX";
import {unpackDTX} from "./unpackDTX";
import {dtxToModel} from "./dtxToModel";

/**
 * Imports [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file data from an ArrayBuffer into a {@link @xeokit/scene!SceneModel | SceneModel}
 * and/or a {@link @xeokit/data!DataModel | DataModel}.
 *
 * * Expects {@link @xeokit/scene!SceneModel.built | SceneModel.built} and
 * {@link @xeokit/scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 * * Expects {@link @xeokit/data!DataModel.built | DataModel.built} and
 * {@link @xeokit/data!DataModel.destroyed | DataModel.destroyed} to be ````false````
 *
 * See {@link "@xeokit/dtx" | @xeokit/dtx} for usage.
 *
 * See {@link @xeokit/dtx!DTXData} for insights into the structure of a [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file.
 *
 * @param params - Loading parameters.
 * @param params.fileData - [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file data
 * @param params.sceneModel - SceneModel to load into.
 * @param params.dataModel - Optional DataModel to load into.
 * @returns {Promise} Resolves when [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) has been loaded.
 * @throws *{@link @xeokit/core!SDKError}*
 * * If the SceneModel has already been destroyed.
 * * If the SceneModel has already been built.
 * * If the DataModel has already been destroyed.
 * * If the DataModel has already been built.
 */
export function loadDTX(params: {
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
    dtxToModel({
        dtxData: inflateDTX(unpackDTX(fileData)),
        sceneModel,
        dataModel,
    });
    return Promise.resolve();
}
