import {DataModel} from "@xeokit/data";
import {SceneModel} from "@xeokit/scene";
import {deflateXKT} from "./deflateXKT";
import {modelToXKT} from "./modelToXKT";
import {packXKT} from "./packXKT";


/**
 * Saves a {@link @xeokit/scene!SceneModel} to an ArrayBuffer containing XKT file data.
 *
 * See {@link @xeokit/xkt} for usage.
 *
 * See {@link XKTData} for insights into the structure of an XKT file.
 *
 * @param params
 * @param params.model The SceneModel to save to XKT.
 * @param params.dataModel The DataModel to save to XKT.
 * @returns The XKT file data in an ArrayBuffer.
 */
export function saveXKT(params: {
    sceneModel: SceneModel,
    dataModel?: DataModel
}): ArrayBuffer {
    return packXKT(deflateXKT(modelToXKT({
        sceneModel: params.sceneModel,
        dataModel: params.dataModel
    })));
}