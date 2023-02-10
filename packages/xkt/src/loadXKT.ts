import {BuildableModel} from "@xeokit/core/components";
import {DataModel} from "@xeokit/datamodel"
import {inflateXKT} from "./lib/inflateXKT";
import {unpackXKT} from "./lib/unpackXKT";
import {xktToModel} from "./lib/xktToModel";

/**
 * Loads XKT file data from an ArrayBuffer into a {@link @xeokit/core/components!BuildableModel}.
 *
 * * Expects {@link @xeokit/core/components!BuildableModel.built} and {@link @xeokit/core/components!BuildableModel.destroyed} to be ````false````
 * * Does not call {@link @xeokit/core/components!BuildableModel.build} - we call that ourselves, when we have finished building the BuildableModel
 *
 * See {@link @xeokit/xkt} for usage.
 *
 * @param params
 * @param params.model The Model to save to XKT.
 * @param params.dataModel The DataModel to save to XKT.
 */
export function loadXKT(params: {
    xkt: ArrayBuffer,
    model: BuildableModel,
    dataModel?: DataModel
}): void {
    xktToModel({
        xktData: inflateXKT(unpackXKT(params.xkt)),
        buildableModel: params.model,
        dataModel: params.dataModel
    });
}