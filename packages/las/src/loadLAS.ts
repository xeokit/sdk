import {LoadParams} from "@xeokit/core/components";

/**
 * Loads LAS/LAZ file data from an ArrayBuffer into a {@link @xeokit/core/components!SceneModel | SceneModel} and (optionally) a {@link @xeokit/datamodel!DataModel | DataModel}.
 *
 * * Expects {@link @xeokit/core/components!SceneModel.built | SceneModel.built} and {@link @xeokit/core/components!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 * * Does not call {@link @xeokit/core/components!SceneModel.build | SceneModel.build} - we call that ourselves, when we have finished building the SceneModel
 *
 * See {@link @xeokit/las} for usage.
 *
 * @param {LoadParams} params Loading parameters.
 * @returns {Promise} Resolves when LAS has been loaded.
 */
export function loadLAS(params: LoadParams): Promise<any> {
    return new Promise<void>(function (resolve, reject) {
        if (!params.data) {
            reject("Argument expected: data");
            return;
        }
        if (!params.sceneModel) {
            reject("Argument expected: sceneModel");
            return;
        }
        resolve();
    });
}
