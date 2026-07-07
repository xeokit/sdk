import type {WebGPUInstancedDrawBatch} from "./WebGPUInstancedDrawBatch";

export interface WebGPUInstancedDrawBatches {
  opaque: WebGPUInstancedDrawBatch[];
  transparent: WebGPUInstancedDrawBatch[];
}
