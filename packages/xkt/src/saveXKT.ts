import {DataModel} from "@xeokit/data";
import {SceneModel} from "@xeokit/scene";
import {deflateXKT} from "./deflateXKT";
import {modelToXKT} from "./modelToXKT";
import {packXKT} from "./packXKT";


/**
 * Saves a {@link @xeokit/scene!SceneModel} and optional {@link @xeokit/data!DataModel} to an ArrayBuffer
 * containing XKT file data.
 *
 * See {@link @xeokit/xkt} for usage.
 *
 * See {@link XKTData} for insights into the structure of an XKT file.
 *
 * @param params
 * @param params.model - The SceneModel to save to XKT.
 * @param params.dataModel - The DataModel to save to XKT.
 * @returns The XKT file data in an ArrayBuffer.
 * @throws {Error} If the SceneModel has already been destroyed.
 * @throws {Error} If the SceneModel has not yet been built.
 * @throws {Error} If the DataModel has already been destroyed.
 * @throws {Error} If the DataModel has not yet been built.
 */
export function saveXKT(params: {
    sceneModel: SceneModel,
    dataModel?: DataModel
}): ArrayBuffer {
    if (params.sceneModel.destroyed) {
        throw new Error("SceneModel already destroyed");
    }
    if (!params.sceneModel.built) {
        throw new Error("SceneModel not yet built");
    }
    if (params.dataModel) {
        if (params.dataModel.destroyed) {
            throw new Error("DataModel already destroyed");
        }
        if (!params.dataModel.built) {
            throw new Error("DataModel not yet built");
        }
    }
    return packXKT(deflateXKT(modelToXKT({
        sceneModel: params.sceneModel,
        dataModel: params.dataModel
    })));
}