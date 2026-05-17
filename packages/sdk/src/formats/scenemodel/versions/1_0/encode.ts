import type {ModelEncodeParams} from "../../../ModelEncodeParams";
import {yieldToHost} from "../../../../base/utils";
import type {LoaderProgress} from "../../../LoaderProgress";

/**
 * @private
 */
export async function encode(params: ModelEncodeParams, options?: any): Promise<any> {
  const opts = options || {};
  const onProgress: ((p: LoaderProgress) => void) | undefined = opts.onProgress;
  const signal: AbortSignal | undefined = opts.signal;
  if (onProgress) {
    onProgress({phase: "Encoding scene model", current: 0, total: 1});
  }
  await yieldToHost(signal);
  let sceneModelParams = {};
  if (params.sceneModel) {
    const result = params.sceneModel.toParams();
    if (result.ok === false) {
      throw new Error(`[SceneModelParamsExporter.export] Failed to encode scene model -> ${result.error}`);
    }
    sceneModelParams = result.value;
  }
  if (onProgress) {
    onProgress({phase: "Encoding scene model", current: 1, total: 1});
  }
  return sceneModelParams;
}
