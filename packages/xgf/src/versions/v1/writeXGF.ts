import {SDKError} from "@xeokit/core";
import type {SceneModel} from "@xeokit/scene";
import {modelToXGF} from "./modelToXGF";
import {packXGF} from "./packXGF";

/** @private
 */
export function writeXGF(params: {
    sceneModel: SceneModel
}): ArrayBuffer {
    if (params.sceneModel.destroyed) {
        throw new SDKError("SceneModel already destroyed");
    }
    if (!params.sceneModel.built) {
        throw new SDKError("SceneModel not yet built");
    }
    return packXGF(
            modelToXGF({
                sceneModel: params.sceneModel
            }));
}
