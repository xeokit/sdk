import type {ModelEncodeParams} from "../../../io";

/**
 * @private
 */
export function encode(params: ModelEncodeParams, options?: any): Promise<any> {
  return new Promise<any>(function (resolve, reject) {
    let sceneModelParams = {};
    if (params.sceneModel) {
      sceneModelParams =params.sceneModel.toParams() ;
    }
   // sceneModelParams.version = "1.0";
    return resolve(sceneModelParams);
  });
}
