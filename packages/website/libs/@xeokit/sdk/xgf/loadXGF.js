import { SceneModel } from "../scene";
import { DataModel } from "../data";
import { readXGF as readXGF_v1 } from "./versions/v1/readXGF";
const readers = {
    1: readXGF_v1
};
/**
 * The XGF versions supported by {@link xgf!loadXGF | loadXGF}.
 */
export const LOADED_XGF_VERSIONS = Object.keys(readers).map(Number);
/**
 * Imports [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf) file data from an ArrayBuffer
 * into a {@link scene!SceneModel | SceneModel}.
 *
 * * Expects {@link scene!SceneModel.built | SceneModel.built} and
 * {@link scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 *
 * See {@link "xgf" | xgf} for usage.
 *
 * @param params - Loading parameters.
 * @param params.fileData - [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf) file data
 * @param params.sceneModel - SceneModel to load geometry and material colors into.
 * @param params.dataModel - Optional DataModel to create default semantic data in.
 * @returns {Promise} Resolves when [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf) has been loaded.
 * @throws *{@link core!SDKError | SDKError}*
 * * If the SceneModel has already been destroyed.
 * * If the SceneModel has already been built.
 * * If the DataModel has already been destroyed.
 * * If the DataModel has already been built.
 */
export function loadXGF(params) {
    return new Promise(function (resolve, reject) {
        if (!params) {
            return reject("Argument expected: params");
        }
        const { fileData, sceneModel, dataModel } = params;
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
        const xgfVersion = dataView.getUint32(0, true);
        const readXGF = readers[xgfVersion];
        if (!readXGF) {
            return reject(`Unsupported XGF file version: ${xgfVersion} - supported versions are [${LOADED_XGF_VERSIONS}]`);
        }
        if (sceneModel || dataModel) {
            readXGF({
                fileData,
                sceneModel,
                dataModel
            });
        }
        return resolve();
    });
}
//# sourceMappingURL=loadXGF.js.map