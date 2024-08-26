import {SDKError} from "@xeokit/core";
import type {SceneModel} from "@xeokit/scene";
import {modelToDTX} from "./modelToDTX";
import {packDTX} from "./packDTX";

/** @private
 */
export function writeDTX(params: {
    sceneModel: SceneModel
}): ArrayBuffer {
    if (params.sceneModel.destroyed) {
        throw new SDKError("SceneModel already destroyed");
    }
    if (!params.sceneModel.built) {
        throw new SDKError("SceneModel not yet built");
    }
    return packDTX(
            modelToDTX({
                sceneModel: params.sceneModel
            }));
}
