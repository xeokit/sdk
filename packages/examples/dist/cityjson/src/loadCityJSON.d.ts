import type { SceneModel } from "@xeokit/scene";
import type { DataModel } from "@xeokit/data";
/**
 * Loads CityJSON into a {@link @xeokit/scene!SceneModel | SceneModel} and/or a {@link @xeokit/data!DataModel | DataModel}.
 *
 * * Expects {@link @xeokit/scene!SceneModel.built | SceneModel.built} and {@link @xeokit/scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 * * Does not call {@link @xeokit/scene!SceneModel.build | SceneModel.build} - we call that ourselves, when we have finished building the SceneModel
 *
 * See {@link "@xeokit/cityjson"} for usage.
 *
 * @param params - Loading parameters.
 * @param params.fileData - CityJSON file data.
 * @param params.sceneModel - SceneModel to load into.
 * @param params.dataModel - DataModel to load into.
 * @param options - CityJSON loading options
 * @param options.rotateX - True to rotate the model about the X-axis. Default is false.
 * @returns {Promise} Resolves when CityJSON has been loaded into the SceneModel and/or DataModel.
 * @throws *{@link @xeokit/core!SDKError}*
 * * If the SceneModel has already been destroyed.
 * * If the SceneModel has already been built.
 * * If the DataModel has already been destroyed.
 * * If the DataModel has already been built.
 */
export declare function loadCityJSON(params: {
    fileData: any;
    sceneModel: SceneModel;
    dataModel?: DataModel;
}, options?: {
    rotateX?: boolean;
}): Promise<any>;
