import {inflateXKT} from "./inflateXKT";
import type {ModelParseParams} from "../../../ModelParseParams";
import {unpackXKT} from "./unpackXKT";
import {xktToModel} from "./xktToModel";

export async function parse(params: ModelParseParams, options: any = {}): Promise<any> {
  const {fileData, sceneModel} = params;
  if (sceneModel) {
    await xktToModel({
      xktData: inflateXKT(unpackXKT(fileData)),
      sceneModel,
      options,
    });
  }
}
