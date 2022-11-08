import {WebGLSceneModel} from "../../../WebGLSceneModel";

export interface BatchingLayerParams {
    uvsDecompressMatrix: any;
    layerIndex: number;
    sceneModel: WebGLSceneModel;
    maxGeometryBatchSize: number;
    scratchMemory: any;
    positionsDecompressMatrix: any;
    origin: any;
}