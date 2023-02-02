import {Model} from "@xeokit/core/components"
import {deflateXKT} from "./lib/deflateXKT";
import {modelToXKT} from "./lib/modelToXKT";
import {packXKT} from "./lib/packXKT";

/**
 * Saves a {@link Model} to an ArrayBuffer containing XKT file data.
 *
 * See {@link @xeokit/xkt} for usage.
 *
 * @param model The Model to save to XKT.
 * @param options Model saving options.
 * @returns The XKT file data in an ArrayBuffer.
 */
export function saveXKT(model: Model, options?: {}): ArrayBuffer {
    return packXKT(deflateXKT(modelToXKT(model, null, {})));
}