import type {ModelEncodeParams} from "../../../../ModelEncodeParams";
import {modelToXKT} from "./modelToXKT";
import {packXKT} from "./packXKT";
import {findTriplanarTextureSkip, triplanarSkipWarning} from "../../../../findTriplanarTextureSkip";

/** @private */
export async function encode(params: ModelEncodeParams, options?: any): Promise<ArrayBuffer> {
  // XKT v12 writes no textures, so triplanar (world-projected) textures aren't
  // exported regardless; warn so the loss is visible.
  if (params.sceneModel) {
    const triplanarSkip = findTriplanarTextureSkip(params.sceneModel);
    if (triplanarSkip.any) {
      const warn = options?.onWarning ?? ((m: string) => console.warn(m));
      warn(triplanarSkipWarning("XKT", triplanarSkip));
    }
  }
  const xktData = await modelToXKT({
    sceneModel: params.sceneModel!,
    dataModel: params.dataModel,
    options,
  });
  return packXKT(xktData);
}
