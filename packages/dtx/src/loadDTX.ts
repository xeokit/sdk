import {SceneModel} from "@xeokit/scene";
import {DataModel} from "@xeokit/data";
import {readDTX as readDTX_v1} from "./versions/v1/readDTX"
import {SDKError} from "@xeokit/core";


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
 * @param params.sceneModel - SceneModel to load into.
 * @param params.dataModel - DataModel to create default semantic data in.
 * @returns {Promise} Resolves when [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) has been loaded.
 * @throws *{@link @xeokit/core!SDKError | SDKError}*
 * * If the SceneModel has already been destroyed.
 * * If the SceneModel has already been built.
 */
export function loadDTX(params: {
    fileData: ArrayBuffer;
    sceneModel: SceneModel;
    dataModel?:DataModel;
}): Promise<void> {
    const {fileData, sceneModel, dataModel} = params;
    if (!fileData) {
        return Promise.reject("Argument expected: params.fileData");
    }
    if (!(fileData instanceof ArrayBuffer)) {
        return Promise.reject("Argument type mismatch: params.fileData should be an ArrayBuffer");
    }
    if (!sceneModel) {
        return Promise.reject("Argument expected: params.sceneModel");
    }
    if (!(sceneModel instanceof SceneModel)) {
        return Promise.reject("Argument type mismatch: params.sceneModel should be a SceneModel");
    }
    if (sceneModel.destroyed) {
        return Promise.reject("SceneModel already destroyed");
    }
    if (sceneModel.built) {
        return Promise.reject("SceneModel already built");
    }
    if (dataModel) {
        if (dataModel.destroyed) {
            return Promise.reject(new SDKError("DataModel already destroyed"));
        }
        if (dataModel.built) {
            return Promise.reject("DataModel already built");
        }
    }
    const arrayBuffer = params.fileData;
    const dataView = new DataView(arrayBuffer);
    const dtxVersion = dataView.getUint32(0, true);
    const readDTX = readers[dtxVersion];
    if (!readDTX) {
        return Promise.reject(`Unsupported DTX file version: ${dtxVersion} - supported versions are [${LOADED_DTX_VERSIONS}]`);
    }
    return readDTX({
        fileData,
        sceneModel,
        dataModel
    });
}
