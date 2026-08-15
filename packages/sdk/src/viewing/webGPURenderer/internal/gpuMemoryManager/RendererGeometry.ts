import type {SceneGeometry} from "../../../../model/scene";

export interface RendererGeometry {
  geometry: SceneGeometry;
  positions: Float32Array;
  uvs: Float32Array | null;
  normals: Float32Array | null;
  indices: Uint16Array | Uint32Array | null;
  edgeIndices: Uint16Array | Uint32Array | null;
  indexFormat: "uint16" | "uint32" | null;
  indexCount: number;
  edgeIndexCount: number;
  numMeshes: number;
}
