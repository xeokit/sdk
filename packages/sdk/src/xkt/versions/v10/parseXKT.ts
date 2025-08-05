import {inflateXKT} from "./inflateXKT";
import type {SceneModel} from "../../../scene";
import {unpackXKT} from "./unpackXKT";
import {xktToModel} from "./xktToModel";

export function parseXKTv10(params: {
  fileData: ArrayBuffer;
  sceneModel: SceneModel;
}): Promise<void> {
  const {fileData, sceneModel} = params;
  if (sceneModel.destroyed) {
    return Promise.reject("SceneModel already destroyed");
  }
  xktToModel({
    xktData: inflateXKT(unpackXKT(fileData)),
    sceneModel
  });
  return Promise.resolve();
}
