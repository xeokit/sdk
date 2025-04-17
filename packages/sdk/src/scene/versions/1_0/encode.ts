import {EncodeParams} from "../../../io";

/**
 * @private
 */
export function encode(params: EncodeParams, options?: any): Promise<any> {
    return new Promise<any>(function (resolve, reject) {
        const sceneModelParams:any = params.sceneModel ? params.sceneModel.toParams() : {};
        sceneModelParams.version = "1.0";
        return resolve(sceneModelParams);
    });
}
