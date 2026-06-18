import type {ModelParseParams} from "../../../../ModelParseParams";
import {unpackXKT} from "./unpackXKT";
import {xktToModel} from "./xktToModel";

/** @private */
export async function parse(params: ModelParseParams, options?: any): Promise<void> {
  const {fileData, sceneModel, dataModel} = params;
  await xktToModel({
    xktData: unpackXKT(fileData),
    sceneModel,
    dataModel,
    options: options || {},
  });
}
