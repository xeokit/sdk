import {BuildableModel} from "@xeokit/core/components";
import {inflateXKT} from "./lib/inflateXKT";
import {unpackXKT} from "./lib/unpackXKT";
import {xktToModel} from "./lib/xktToModel";

/**
 * Loads XKT file data from an ArrayBuffer into a {@link BuildableModel}.
 *
 * * Expects {@link BuildableModel.built} and {@link BuildableModel.destroyed} to be ````false````
 * * Does not call {@link BuildableModel.build} - we call that ourselves, when we have finished building the BuildableModel
 *
 * See {@link @xeokit/xkt} for usage.
 *
 * @param xkt
 * @param buildableModel
 * @param options
 */
export function loadXKT(xkt: ArrayBuffer, buildableModel: BuildableModel, options?: {}) {
    xktToModel(inflateXKT(unpackXKT(xkt)), buildableModel, options);
}