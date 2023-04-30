import type {DataModel} from "@xeokit/data";
import type {SceneModel} from "@xeokit/scene";
import {deflateXKT} from "./deflateXKT";
import {modelToXKT} from "./modelToXKT";
import {packXKT} from "./packXKT";
import {SDKError} from "@xeokit/core";


/**
 * Exports a {@link @xeokit/scene!SceneModel | SceneModel} and/or a {@link @xeokit/data!DataModel} to an ArrayBuffer
 * containing XKT file data.
 *
 * See {@link @xeokit/xkt} for usage.
 *
 * See {@link XKTData} for insights into the structure of an XKT file.
 *
 * @param params
 * @param params.sceneModel - The SceneModel to export to XKT.
 * @param params.dataModel - Optional DataModel to export to XKT.
 * @returns The XKT file data in an ArrayBuffer.
 * @returns {@link @xeokit/core!SDKError} If the SceneModel has already been destroyed.
 * @returns {@link @xeokit/core!SDKError} If the SceneModel has not yet been built.
 * @returns {@link @xeokit/core!SDKError} If the DataModel has already been destroyed.
 * @returns {@link @xeokit/core!SDKError} If the DataModel has not yet been built.
 */
export function saveXKT(params: {
    sceneModel: SceneModel,
    dataModel?: DataModel
}): ArrayBuffer {
    if (params.sceneModel.destroyed) {
        throw new SDKError("SceneModel already destroyed");
    }
    if (!params.sceneModel.built) {
        throw new SDKError("SceneModel not yet built");
    }
    if (params.dataModel) {
        if (params.dataModel.destroyed) {
            throw new SDKError("DataModel already destroyed");
        }
        if (!params.dataModel.built) {
            throw new SDKError("DataModel not yet built");
        }
    }
    return packXKT(deflateXKT(modelToXKT({
        sceneModel: params.sceneModel,
        dataModel: params.dataModel
    })));
}