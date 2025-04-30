import { inflateXKT } from "./inflateXKT";
import { unpackXKT } from "./unpackXKT";
import { xktToModel } from "./xktToModel";
import { ModelParseParams } from "../../../io";

export function parse(params: ModelParseParams, options: any = {}): Promise<any> {
  return new Promise<void>(function (resolve, reject) {
    const { fileData, sceneModel } = params;
    if (sceneModel) {
      xktToModel({
        xktData: inflateXKT(unpackXKT(fileData)),
        sceneModel
      });
    }
    return resolve();
  });
}
