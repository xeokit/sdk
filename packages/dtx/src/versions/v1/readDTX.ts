import {unpackDTX} from "./unpackDTX";
import {SceneModel} from "@xeokit/scene";
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
        return Promise.reject("SceneModel already destroyed");
    }
    if (sceneModel.built) {
        return Promise.reject("SceneModel already built");
    }
    dtxToModel({
        dtxData: unpackDTX(fileData),
        sceneModel
    });
    return Promise.resolve();
}
