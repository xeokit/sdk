import type {SceneGeometry} from "../../../../model/scene";
import type {WebGPUBufferLike} from "../../core";

export interface WebGPUGeometryState {
  geometry: SceneGeometry;
  vertexBuffer: WebGPUBufferLike;
  normalBuffer: WebGPUBufferLike;
  indexBuffer: WebGPUBufferLike;
  indexFormat: "uint16" | "uint32";
  indexCount: number;
  numMeshes: number;
}
