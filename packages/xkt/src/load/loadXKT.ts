import {SDKError} from "@xeokit/core";
import type {SceneModel} from "@xeokit/scene";
import {parseXKTv10} from "./parsers/v10/parseXKT"

const parsers = {
    10: parseXKTv10
};

/**
 * Imports [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file data from an ArrayBuffer
 * into a {@link @xeokit/scene!SceneModel | SceneModel}.
 *
 * * Expects {@link @xeokit/scene!SceneModel.built | SceneModel.built} and
 * {@link @xeokit/scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 *
 * See {@link "@xeokit/xkt" | @xeokit/xkt} for usage.
 *
 * See {@link @xeokit/xkt!XKTData} for insights into the structure of a [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file.
 *
 * @param params - Loading parameters.
 * @param params.fileData - [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file data
 * @param params.sceneModel - SceneModel to load into.
 * @returns {Promise} Resolves when [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) has been loaded.
 * @throws *{@link @xeokit/core!SDKError}*
 * * If the SceneModel has already been destroyed.
 * * If the SceneModel has already been built.
 */
export function loadXKT(params: {
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
    return parseXKTv10(params);
}
