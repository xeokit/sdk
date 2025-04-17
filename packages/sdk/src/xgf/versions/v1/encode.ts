
import type {SceneModel} from "../../../scene";
import {modelToXGF} from "./modelToXGF";
import {packXGF} from "./packXGF";

/** @private
 */
export function encode(params: {
    sceneModel?: SceneModel
}): Promise<any> {
    return new Promise<any>(function (resolve, reject) {
        resolve(packXGF(modelToXGF({sceneModel: params.sceneModel})));  // FIXME: What if no SceneModel?
    });
}
