import type {SceneMesh} from "../../../../model/scene";
import type {WebGPUGeometryState} from "./WebGPUGeometryState";

export interface WebGPUMeshState {
  mesh: SceneMesh;
  geometryState: WebGPUGeometryState;
}
