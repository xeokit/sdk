import type {ModelParseParams} from "../../../ModelParseParams";

/**
 * @private
 */
export function parse(params: ModelParseParams, options?: any): Promise<void> {
  return new Promise<void>(function (resolve, reject) {
    if (params.sceneModel && params.fileData) {
      const result = params.sceneModel.fromParams(params.fileData);
        if (result.ok===false) {
            return reject(new Error(`[SceneModelImporter.loader] Failed to parse scene model -> ${result.error}`));
        }
    }
    return resolve();
  });
}
