import type {ModelEncodeParams} from "../../../io";
import {modelToXGF} from "./modelToXGF";
import {packXGF} from "./packXGF";

/** @private
 */
export function encode(params: ModelEncodeParams, options?: any): Promise<any> {
  return new Promise<any>(function (resolve, reject) {
    resolve(packXGF(modelToXGF({sceneModel: params.sceneModel, options}))); // FIXME: What if no SceneModel?
  });
}
