import {ModelParseParams} from "../../../io";

/**
 * @private
 */
export function parse(params: ModelParseParams, options?: any): Promise<void> {
    return new Promise<void>(function (resolve, reject) {
        if (params.sceneModel && params.fileData) {
            params.sceneModel.fromParams(params.fileData);
        }
        return resolve();
    });
}
