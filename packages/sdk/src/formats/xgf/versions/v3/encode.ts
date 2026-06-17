import type {ModelEncodeParams} from "../../../ModelEncodeParams";
import {modelToXGF} from "./modelToXGF";
import {packXGF} from "./packXGF";

/** @private */
export async function encode(params: ModelEncodeParams, options?: any): Promise<ArrayBuffer> {
  const xgfData = await modelToXGF({sceneModel: params.sceneModel, options});
  return packXGF(xgfData);
}
