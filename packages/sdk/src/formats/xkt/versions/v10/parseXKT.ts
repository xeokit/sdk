import {inflateXKT} from "./inflateXKT";
import type {SceneModel} from "../../../../model/scene";
import {unpackXKT} from "./unpackXKT";
import {xktToModel} from "./xktToModel";

export async function parseXKTv10(params: {
  fileData: ArrayBuffer;
  sceneModel: SceneModel;
}): Promise<void> {
  const {fileData, sceneModel} = params;
  if (sceneModel.destroyed) {
    throw new Error("SceneModel already destroyed");
  }
  await xktToModel({
    xktData: inflateXKT(unpackXKT(fileData)),
    sceneModel,
  });
}
