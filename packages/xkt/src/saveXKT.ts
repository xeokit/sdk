import {Model} from "@xeokit/core/components"
import {deflateXKT} from "./lib/deflateXKT";
import {modelToXKT} from "./lib/modelToXKT";
import {packXKT} from "./lib/packXKT";
import {DataModel} from "@xeokit/datamodel";

/**
 * Saves a {@link @xeokit/core/components!Model} to an ArrayBuffer containing XKT file data.
 *
 * See {@link @xeokit/xkt} for usage.
 *
 * @param params
 * @param params.model The Model to save to XKT.
 * @param params.dataModel The DataModel to save to XKT.
 * @returns The XKT file data in an ArrayBuffer.
 */
export function saveXKT(params: {
    model: Model,
    dataModel?: DataModel
}): ArrayBuffer {
    return packXKT(deflateXKT(modelToXKT({model: params.model, dataModel: params.dataModel})));
}