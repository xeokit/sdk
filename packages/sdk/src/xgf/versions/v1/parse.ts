import { ModelParseParams } from "../../../io";
import { unpackXGF } from "./unpackXGF";
import { xgfToModel } from "./xgfToModel";

/**
 * @private
 */
export function parse(params: ModelParseParams, options?: any): Promise<void> {
  return new Promise<void>(function (resolve, reject) {
    const { fileData, sceneModel, dataModel } = params;
    xgfToModel({
      xgfData: unpackXGF(fileData),
      sceneModel,
      dataModel
    });
    resolve();
  });
}
