import {LoadParams} from "@xeokit/core/components";
import {inflateXKT} from "./lib/inflateXKT";
import {unpackXKT} from "./lib/unpackXKT";
import {xktToModel} from "./lib/xktToModel";

/**
 * Loads XKT file data from an ArrayBuffer into a {@link @xeokit/core/components!Model | Model} and (optionally) a {@link @xeokit/datamodel!DataModel | DataModel}.
 *
 * * Expects {@link @xeokit/core/components!Model.built | Model.built} and {@link @xeokit/core/components!Model.destroyed | Model.destroyed} to be ````false````
 * * Does not call {@link @xeokit/core/components!Model.build | Model.build} - we call that ourselves, when we have finished building the Model
 *
 * See {@link @xeokit/xkt} for usage.
 *
 * @param {LoadParams} params Loading parameters.
 * @returns {Promise} Resolves when XKT has been loaded.
 */
export function loadXKT(params: LoadParams): Promise<any> {
    return new Promise<void>(function (resolve, reject) {
        if (!params.data) {
            reject("Argument expected: data");
            return;
        }
        if (!params.model) {
            reject("Argument expected: model");
            return;
        }
        xktToModel({
            xktData: inflateXKT(unpackXKT(params.data)),
            model: params.model,
            dataModel: params.dataModel
        });
        resolve();
    });
}
