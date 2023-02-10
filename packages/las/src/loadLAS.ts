import {LoadParams} from "@xeokit/core/components";

/**
 * Loads LAS/LAZ file data from an ArrayBuffer into a {@link @xeokit/core/components!BuildableModel | BuildableModel} and (optionally) a {@link @xeokit/datamodel!DataModel | DataModel}.
 *
 * * Expects {@link @xeokit/core/components!BuildableModel.built | BuildableModel.built} and {@link @xeokit/core/components!BuildableModel.destroyed | BuildableModel.destroyed} to be ````false````
 * * Does not call {@link @xeokit/core/components!BuildableModel.build | BuildableModel.build} - we call that ourselves, when we have finished building the BuildableModel
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
        if (!params.model) {
            reject("Argument expected: model");
            return;
        }
        resolve();
    });
}
