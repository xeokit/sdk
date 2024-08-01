import {inflateXKT} from "./inflateXKT";
import {unpackXKT} from "./unpackXKT";
import {SceneModel} from "@xeokit/scene";
import {SDKError} from "@xeokit/core";
import {xktToModel} from "./xktToModel";

export function parseXKTv10(params: {
    fileData: ArrayBuffer;
    sceneModel: SceneModel;
}): Promise<void> {
    const {fileData, sceneModel} = params;
    if (sceneModel.destroyed) {
        return Promise.reject(new SDKError("SceneModel already destroyed"));
    }
    if (sceneModel.built) {
        return Promise.reject(new SDKError("SceneModel already built"));
    }
    xktToModel({
        xktData: inflateXKT(unpackXKT(fileData)),
        sceneModel
    });
    return Promise.resolve();
}
