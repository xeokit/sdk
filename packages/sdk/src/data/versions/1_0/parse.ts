import type {ModelParseParams} from "../../../io";

/**
 * @private
 */
export function parse(params: ModelParseParams, options?: any): Promise<void> {
  return new Promise<void>(function (resolve, reject) {
    if (params.dataModel && params.fileData) {
      const result = params.dataModel.fromParams(params.fileData);
        if (result.ok===false) {
            return reject(new Error(`Failed to parse data model: ${result.error}`));
        }
    }
    return resolve();
  });
}
