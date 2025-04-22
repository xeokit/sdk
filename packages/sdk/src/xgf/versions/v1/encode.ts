import {modelToXGF} from "./modelToXGF";
import {packXGF} from "./packXGF";
import {ModelEncodeParams} from "../../../io";

/** @private
 */
export function encode(params: ModelEncodeParams, options?: any): Promise<any> {
    return new Promise<any>(function (resolve, reject) {
        resolve(packXGF(modelToXGF({sceneModel: params.sceneModel})));  // FIXME: What if no SceneModel?
    });
}
