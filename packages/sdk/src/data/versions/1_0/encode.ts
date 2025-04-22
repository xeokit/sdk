import {ModelEncodeParams} from "../../../io";

/**
 * @private
 */
export function encode(params: ModelEncodeParams, options?: any): Promise<any> {
    return new Promise<any>(function (resolve, reject) {
        const dataModelParams:any = params.dataModel ? params.dataModel.toParams() : {};
        dataModelParams.version = "1.0";
        return resolve(dataModelParams);
    });
}
