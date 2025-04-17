import {ParseParams} from "../../../io";

/**
 * @private
 */
export function parse(params: ParseParams, options?: any): Promise<void> {
    return new Promise<void>(function (resolve, reject) {
        if (params.dataModel && params.fileData) {
            params.dataModel.fromParams(params.fileData);
        }
        return resolve();
    });
}
