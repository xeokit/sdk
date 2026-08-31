import type {RendererMesh} from "../meshManager";
import type {MeshDrawStyle} from "../meshManager/resolveMeshDrawStyle";

export interface DrawItem {
  meshState: RendererMesh;
  opacity: number;
  viewDepth: number;
  style: MeshDrawStyle | null;
}
