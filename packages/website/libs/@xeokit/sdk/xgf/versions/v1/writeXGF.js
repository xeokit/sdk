import { SDKError } from "../../../core";
import { modelToXGF } from "./modelToXGF";
import { packXGF } from "./packXGF";
/** @private
 */
export function writeXGF(params) {
    if (params.sceneModel.destroyed) {
        throw new SDKError("SceneModel already destroyed");
    }
    if (!params.sceneModel.built) {
        throw new SDKError("SceneModel not yet built");
    }
    return packXGF(modelToXGF({
        sceneModel: params.sceneModel
    }));
}
//# sourceMappingURL=writeXGF.js.map