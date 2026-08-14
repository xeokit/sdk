import type {RendererMesh} from "../meshManager";

export interface DrawItem {
  meshState: RendererMesh;
  opacity: number;
  viewDepth: number;
}
