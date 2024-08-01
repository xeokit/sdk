import {inflateDTX} from "./inflateDTX";
import {unpackDTX} from "./unpackDTX";
import {SceneModel} from "@xeokit/scene";
import {SDKError} from "@xeokit/core";
import {dtxToModel} from "./dtxToModel";

/**
 * @private
 */
export function readDTX(params: {
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
    dtxToModel({
        dtxData: inflateDTX(unpackDTX(fileData)),
        sceneModel
    });
    return Promise.resolve();
}
