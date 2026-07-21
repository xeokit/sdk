import type {ModelParseParams} from "../../../ModelParseParams";
import {xgfToModel} from "./xgfToModel";
import {unpackXGF} from "./unpackXGF";

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
