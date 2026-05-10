import type {ModelEncodeParams} from "../../../ModelEncodeParams";
import {yieldToHost} from "../../../../utils";
import type {LoaderProgress} from "../../../LoaderProgress";

/**
 * @private
 */
export async function encode(params: ModelEncodeParams, options?: any): Promise<any> {
  const opts = options || {};
  const onProgress: ((p: LoaderProgress) => void) | undefined = opts.onProgress;
  const signal: AbortSignal | undefined = opts.signal;
  if (onProgress) {
    onProgress({phase: "Encoding data model", current: 0, total: 1});
  }
  await yieldToHost(signal);
  const dataModelParamsResult: any = params.dataModel ? params.dataModel.toParams() : {};
  if (dataModelParamsResult.ok === false) {
    throw new Error(`Failed to encode data model -> ${dataModelParamsResult.error}`);
  }
  const dataModelParams = dataModelParamsResult.value;
  dataModelParams.version = "1.0";
  if (onProgress) {
    onProgress({phase: "Encoding data model", current: 1, total: 1});
  }
  return dataModelParams;
}
