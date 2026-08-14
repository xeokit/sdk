import type {WebGPUBindGroupLike, WebGPUBufferLike} from "../../core";

export interface PackedMeshBatch {
  label: string;
  segmentKey: string;
  bufferPageKey?: string;
  renderStateKey?: string;
  topology?: "triangles" | "edges";
  vertexBuffer: WebGPUBufferLike;
  vertexBufferOffset?: number;
  positionDecodeBindGroup: WebGPUBindGroupLike;
  vertexMetadataBuffer: WebGPUBufferLike;
  vertexMetadataBufferOffset?: number;
  indexBuffer: WebGPUBufferLike;
  indexBufferOffset?: number;
  indexFormat: "uint16" | "uint32";
  indexCount: number;
  firstIndex?: number;
  temporaryIndexBuffer?: boolean;
  temporaryIndexBufferCreated?: boolean;
  destroy(): void;
}
