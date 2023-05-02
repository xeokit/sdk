import type {SceneModel} from "@xeokit/scene";
import type {DataModel} from "@xeokit/data";
import {SDKError} from "@xeokit/core";

/**
 * Loads LAS/LAZ file data from an ArrayBuffer into a {@link @xeokit/scene!SceneModel | SceneModel} and/or a {@link @xeokit/data!DataModel | DataModel}.
 *
 * * Expects {@link @xeokit/scene!SceneModel.built | SceneModel.built} and {@link @xeokit/scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 * * Does not call {@link @xeokit/scene!SceneModel.build | SceneModel.build} - we call that ourselves, when we have finished building the SceneModel
 *
 * See {@link "@xeokit/las"} for usage.
 *
 * @param params - Loading parameters.
 * @param params.data - LAS/LAZ file data
 * @param params.sceneModel - SceneModel to load into.
 * @param params.dataModel - DataModel to load into.
 * @returns {Promise} Resolves when LAS has been loaded.
 */
export function loadLAS(params: {
    data: ArrayBuffer,
    sceneModel: SceneModel,
    dataModel?: DataModel,
    log?: Function
}): Promise<any> {
    return new Promise<void>(function (resolve, reject) {
        const dataModel = params.dataModel;
        const sceneModel = params.sceneModel;
        if (sceneModel?.destroyed) {
            throw new Error("SceneModel already destroyed");
        }
        if (sceneModel?.built) {
            throw new Error("SceneModel already built");
        }
        if (dataModel?.destroyed) {
            throw new Error("DataModel already destroyed");
        }
        if (dataModel?.built) {
            throw new Error("DataModel already built");
        }
        // TODO

        resolve();
    });
}
