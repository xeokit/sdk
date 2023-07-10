import type { SceneModel } from "@xeokit/scene";
import type { DataModel } from "@xeokit/data";
/**
 * Loads .BIM into a {@link @xeokit/scene!SceneModel | SceneModel} and/or a {@link @xeokit/data!DataModel | DataModel}.
 *
 * * Expects {@link @xeokit/scene!SceneModel.built | SceneModel.built} and {@link @xeokit/scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 * * Does not call {@link @xeokit/scene!SceneModel.build | SceneModel.build} - we call that ourselves, when we have finished building the SceneModel
 *
 * See {@link "@xeokit/dotbim"} for usage.
 *
 * @param params - Loading parameters.
 * @param params.fileData - .BIM file data.
 * @param params.sceneModel - SceneModel to load into.
 * @param params.dataModel - DataModel to load into.
 * @param options - .BIM loading options
 * @param options.error - Callback to log any non-fatal errors that occur while loading.
 * @returns {Promise} Resolves when .BIM has been loaded into the SceneModel and/or DataModel.
 * @throws *{@link @xeokit/core!SDKError}*
 * * If the SceneModel has already been destroyed.
 * * If the SceneModel has already been built.
 * * If the DataModel has already been destroyed.
 * * If the DataModel has already been built.
 */
export declare function loadDotBIM(params: {
    fileData: any;
    sceneModel: SceneModel;
    dataModel?: DataModel;
}, options?: {
    error?: (errMsg: string) => void;
}): Promise<any>;
