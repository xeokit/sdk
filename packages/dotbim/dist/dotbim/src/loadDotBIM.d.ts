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
 * @param params.data - .BIM file data.
 * @param params.sceneModel - SceneModel to load into.
 * @param params.dataModel - DataModel to load into.
 * @param options - .BIM loading options
 * @returns {@link @xeokit/core!SDKError} If the SceneModel has already been destroyed.
 * @returns {@link @xeokit/core!SDKError} If the SceneModel has already been built.
 * @returns {@link @xeokit/core!SDKError} If the DataModel has already been destroyed.
 * @returns {@link @xeokit/core!SDKError} If the DataModel has already been built.
 * @returns {Promise} Resolves when .BIM has been loaded into the SceneModel and/or DataModel.
 */
export declare function loadDotBIM(params: {
    data: any;
    sceneModel: SceneModel;
    dataModel?: DataModel;
}, options?: {
    rotateX?: boolean;
}): Promise<any>;
