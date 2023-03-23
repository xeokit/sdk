import {DataModel} from "@xeokit/data";
import {SceneModel} from "@xeokit/scene";
import {deflateXKT} from "./deflateXKT";
import {modelToXKT} from "./modelToXKT";
import {packXKT} from "./packXKT";


/**
 * Exports a {@link @xeokit/scene!SceneModel | SceneModel} and/or a {@link @xeokit/data!DataModel} to an ArrayBuffer
 * containing XKT file data.
 *
 * See {@link @xeokit/xkt} for usage.
 *
 * See {@link XKTData} for insights into the structure of an XKT file.
 *
 * @param params
 * @param params.model - The SceneModel to export to XKT.
 * @param params.dataModel - The DataModel to export to XKT.
 * @returns The XKT file data in an ArrayBuffer.
 * @throws {@link Error} If the SceneModel has already been destroyed.
 * @throws {@link Error} If the SceneModel has not yet been built.
 * @throws {@link Error} If the DataModel has already been destroyed.
 * @throws {@link Error} If the DataModel has not yet been built.
 */
export function saveXKT(params: {
    sceneModel?: SceneModel,
    dataModel?: DataModel
}): ArrayBuffer {
    const sceneModel = params.sceneModel
    const dataModel = params.dataModel;
    if (sceneModel.destroyed) {
        throw new Error("SceneModel already destroyed");
    }
    if (!sceneModel.built) {
        throw new Error("SceneModel not yet built");
    }
    if (dataModel) {
        if (dataModel.destroyed) {
            throw new Error("DataModel already destroyed");
        }
        if (!dataModel.built) {
            throw new Error("DataModel not yet built");
        }
    }
    return packXKT(deflateXKT(modelToXKT({sceneModel, dataModel})));
}