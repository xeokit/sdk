import {unpackDTX} from "./unpackDTX";
import {SceneModel} from "@xeokit/scene";
import {dtxToModel} from "./dtxToModel";
import {DataModel} from "@xeokit/data";

/**
 * @private
 */
export function readDTX(params: {
    fileData: ArrayBuffer;
    sceneModel?: SceneModel;
    dataModel?: DataModel;
}): void {
    const {fileData, sceneModel, dataModel} = params;
    dtxToModel({
        dtxData: unpackDTX(fileData),
        sceneModel,
        dataModel
    });
}
