import type {WebGPUBufferLike} from "../../core";

export interface WebGPUPackedMeshBatch {
  vertexBuffer: WebGPUBufferLike;
  normalBuffer: WebGPUBufferLike;
  meshIndexBuffer: WebGPUBufferLike;
  indexBuffer: WebGPUBufferLike;
  indexFormat: "uint16" | "uint32";
  indexCount: number;
  destroy(): void;
}
