import type {WebGPUMeshState} from "./WebGPUMeshState";

export interface WebGPUDrawItem {
  meshState: WebGPUMeshState;
  opacity: number;
  viewDepth: number;
}
