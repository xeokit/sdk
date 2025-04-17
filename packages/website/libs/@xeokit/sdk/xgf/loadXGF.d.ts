import { SceneModel } from "../scene";
import { DataModel } from "../data";
/**
 * The XGF versions supported by {@link xgf!XGFLoader | XGFLoader}.
 */
export declare const LOADED_XGF_VERSIONS: number[];
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
export declare function XGFReader(params: {
    fileData: ArrayBuffer;
    sceneModel?: SceneModel;
    dataModel?: DataModel;
}): Promise<void>;
//# sourceMappingURL=XGFLoader.d.ts.map
