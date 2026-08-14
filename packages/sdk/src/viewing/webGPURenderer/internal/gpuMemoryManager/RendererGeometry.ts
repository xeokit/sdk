import type {SceneGeometry} from "../../../../model/scene";

export interface RendererGeometry {
  geometry: SceneGeometry;
  positions: Float32Array;
  indices: Uint16Array | Uint32Array;
  edgeIndices: Uint16Array | Uint32Array | null;
  indexFormat: "uint16" | "uint32";
  indexCount: number;
  edgeIndexCount: number;
  numMeshes: number;
}
