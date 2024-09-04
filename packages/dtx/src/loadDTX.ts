import {SceneModel} from "@xeokit/scene";
import {DataModel} from "@xeokit/data";
import {readDTX as readDTX_v1} from "./versions/v1/readDTX"


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
export function loadDTX(params: {
    fileData: ArrayBuffer;
    sceneModel?: SceneModel;
    dataModel?: DataModel;
}): Promise<void> {
    return new Promise<void>(function (resolve, reject) {
        if (!params) {
            return reject("Argument expected: params");
        }
        const {fileData, sceneModel, dataModel} = params;
        if (!fileData) {
            return reject("Argument expected: params.fileData");
        }
        if (!(fileData instanceof ArrayBuffer)) {
            return reject("Argument type mismatch: params.fileData should be an ArrayBuffer");
        }
        if (sceneModel) {
            if (!(sceneModel instanceof SceneModel)) {
                return reject("Argument type mismatch: params.sceneModel should be a SceneModel");
            }
            if (sceneModel.destroyed) {
                return reject("SceneModel already destroyed");
            }
            if (sceneModel.built) {
                return reject("SceneModel already built");
            }
        }
        if (dataModel) {
            if (!(dataModel instanceof DataModel)) {
                return reject("Argument type mismatch: params.dataModel should be a DataModel");
            }
            if (dataModel.destroyed) {
                return reject("DataModel already destroyed");
            }
            if (dataModel.built) {
                return reject("DataModel already built");
            }
        }
        const arrayBuffer = params.fileData;
        const dataView = new DataView(arrayBuffer);
        const dtxVersion = dataView.getUint32(0, true);
        const readDTX = readers[dtxVersion];
        if (!readDTX) {
            return reject(`Unsupported DTX file version: ${dtxVersion} - supported versions are [${LOADED_DTX_VERSIONS}]`);
        }
        if (sceneModel || dataModel) {
            readDTX({
                fileData,
                sceneModel,
                dataModel
            });
        }
        return resolve();
    });
}
