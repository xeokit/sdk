import type { SceneModel } from "../scene";
/**
 * Imports [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file data from an ArrayBuffer
 * into a {@link scene!SceneModel | SceneModel}.
 *
 * * Expects {@link scene!SceneModel.built | SceneModel.built} and
 * {@link scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 *
 * See {@link xkt} for usage.
 *
 * @param params - Loading parameters.
 * @param params.fileData - [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file data
 * @param params.sceneModel - SceneModel to load into.
 * @returns {Promise} Resolves when [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) has been loaded.
 * @throws *{@link core!SDKError | SDKError}*
 * * If the SceneModel has already been destroyed.
 * * If the SceneModel has already been built.
 */
export declare function loadXKT(params: {
    fileData: ArrayBuffer;
    sceneModel: SceneModel;
}): Promise<void>;
//# sourceMappingURL=loadXKT.d.ts.map