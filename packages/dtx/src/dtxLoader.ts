import {SceneModel} from "@xeokit/scene";
import {DataModel} from "@xeokit/data";
import {readDTX as readDTX_v1} from "./versions/v1/readDTX"
import {SDKError} from "@xeokit/core";
import {loadDTX} from "./loadDTX";


const readers = {
    1: readDTX_v1
};

/**
 * The DTX versions supported by {@link @xeokit/dtx!loadDTX | loadDTX}.
 */
export const LOADED_DTX_VERSIONS: number[] = Object.keys(readers).map(Number);

/**
 * Imports [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file data from an ArrayBuffer
 * into a {@link @xeokit/scene!SceneModel | SceneModel}.
 *
 * * Expects {@link @xeokit/scene!SceneModel.built | SceneModel.built} and
 * {@link @xeokit/scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 *
 * See {@link "@xeokit/dtx" | @xeokit/dtx} for usage.
 *
 * @param params - Loading parameters.
 * @param params.fileData - [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file data
 * @param params.sceneModel - SceneModel to load geometry and material colors into.
 * @param params.dataModel - Optional DataModel to create default semantic data in.
 * @returns {Promise} Resolves when [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) has been loaded.
 * @throws *{@link @xeokit/core!SDKError | SDKError}*
 * * If the SceneModel has already been destroyed.
 * * If the SceneModel has already been built.
 * * If the DataModel has already been destroyed.
 * * If the DataModel has already been built.
 */
export class DTXLoader {
    static extensions: string[] = ["dtx"];
    static mimeType: string = "arraybuffer";
    static load = loadDTX;
}
