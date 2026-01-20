import type {ModelEncodeParams} from "../../../ModelEncodeParams";

/**
 * @private
 */
export function encode(params: ModelEncodeParams, options?: any): Promise<any> {
  return new Promise<any>(function (resolve, reject) {
    let sceneModelParams = {};
    if (params.sceneModel) {
      const result =params.sceneModel.toParams() ;
        if (result.ok===false) {
            return reject(new Error(`Failed to encode scene model: ${result.error}`));
        }
        sceneModelParams = result.value;
    }
   // sceneModelParams.version = "1.0";
    return resolve(sceneModelParams);
  });
}
