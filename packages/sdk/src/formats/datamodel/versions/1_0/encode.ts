import type {ModelEncodeParams} from "../../../ModelEncodeParams";

/**
 * @private
 */
export function encode(params: ModelEncodeParams, options?: any): Promise<any> {
  return new Promise<any>(function (resolve, reject) {
    const dataModelParamsResult: any = params.dataModel ? params.dataModel.toParams() : {};
    if (dataModelParamsResult.ok === false) {
      return reject(new Error(`Failed to encode data model -> ${dataModelParamsResult.error}`));
    }
    const dataModelParams = dataModelParamsResult.value;
    dataModelParams.version = "1.0";
    return resolve(dataModelParams);
  });
}
