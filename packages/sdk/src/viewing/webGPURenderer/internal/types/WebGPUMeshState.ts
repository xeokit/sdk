import type {SceneMesh} from "../../../../model/scene";
import type {Mat4} from "../../../../base/math/matrix";
import type {WebGPUGeometryState} from "./WebGPUGeometryState";

export interface WebGPUMeshState {
  mesh: SceneMesh;
  geometryState: WebGPUGeometryState;
  worldMatrix: Mat4;
  normalMatrix: Mat4;
  matrixDirty: boolean;
}
