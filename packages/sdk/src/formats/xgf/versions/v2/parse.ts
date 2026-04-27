import type {ModelParseParams} from "../../../ModelParseParams";
import {unpackXGF} from "./unpackXGF";
import {xgfToModel} from "./xgfToModel";

/** @private */
export async function parse(params: ModelParseParams, options?: any): Promise<void> {
  const {fileData, sceneModel, dataModel} = params;
  await xgfToModel({
    xgfData: unpackXGF(fileData),
    sceneModel,
    dataModel,
    options
  });
}
