import type {WebGPUGeometryState} from "./WebGPUGeometryState";

export interface WebGPUInstancedDrawBatch {
  geometryState: WebGPUGeometryState;
  firstInstance: number;
  instanceCount: number;
}
