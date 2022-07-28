import {FloatArrayType} from "../math/math";

export interface SceneModelCfg {
    id?: string;
    pbrEnabled?: boolean;
    saoEnabled?: boolean;
    matrix?: FloatArrayType;
    scale?: FloatArrayType;
    quaternion?: FloatArrayType;
    rotation?: FloatArrayType;
    position?: FloatArrayType;
    origin?: FloatArrayType;
}