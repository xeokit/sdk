import type {ModelEncodeParams} from "../../../../ModelEncodeParams";
import {modelToXKT} from "./modelToXKT";
import {packXKT} from "./packXKT";

/** @private */
export async function encode(params: ModelEncodeParams, options?: any): Promise<ArrayBuffer> {
  const xktData = await modelToXKT({
    sceneModel: params.sceneModel!,
    dataModel: params.dataModel,
    options,
  });
  return packXKT(xktData);
}
