import {SceneModel, math} from "../../../viewer/index"
import {MeshCounts} from "./MeshCounts";
import {WebGLSceneModel} from "../WebGLSceneModel";

export interface LayerParams {
    gl: WebGL2RenderingContext;
    sceneModel: WebGLSceneModel;
    meshCounts: MeshCounts;
    primitive: number;
    origin: math.FloatArrayType;
    layerIndex: number;
}