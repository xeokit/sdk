import {SDKError} from "@xeokit/core";
import type {SceneModel} from "@xeokit/scene";
import {inflateDTX} from "./inflateDTX";
import {unpackDTX} from "./unpackDTX";
import {dtxToModel} from "./dtxToModel";

/**
 * Imports [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file data from an ArrayBuffer
 * into a {@link @xeokit/scene!SceneModel | SceneModel}.
 *
 * * Expects {@link @xeokit/scene!SceneModel.built | SceneModel.built} and
 * {@link @xeokit/scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 *
 * See {@link "@xeokit/dtx" | @xeokit/dtx} for usage.
 *
 * See {@link @xeokit/dtx!DTXData} for insights into the structure of a [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file.
 *
 * @param params - Loading parameters.
 * @param params.fileData - [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file data
 * @param params.sceneModel - SceneModel to load into.
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
 }): Promise<void> {
    const {fileData, sceneModel} = params;
    if (sceneModel.destroyed) {
        return Promise.reject(new SDKError("SceneModel already destroyed"));
    }
    if (sceneModel.built) {
        return Promise.reject(new SDKError("SceneModel already built"));
    }
    dtxToModel({
        dtxData: inflateDTX(unpackDTX(fileData)),
        sceneModel
    });
    return Promise.resolve();
}
