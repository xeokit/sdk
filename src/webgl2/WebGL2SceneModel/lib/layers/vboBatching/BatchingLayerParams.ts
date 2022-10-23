import {WebGL2SceneModel} from "../../../WebGL2SceneModel";

export interface BatchingLayerParams {
    uvsDecompressMatrix: any;
    layerIndex: number;
    sceneModel: WebGL2SceneModel;
    maxGeometryBatchSize: number;
    scratchMemory: any;
    positionsDecompressMatrix: any;
    origin: any;
}