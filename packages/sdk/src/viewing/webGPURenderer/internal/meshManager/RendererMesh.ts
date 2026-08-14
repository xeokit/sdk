import type {Mat4} from "../../../../base/math/matrix";
import type {SceneMesh, SceneModel} from "../../../../model/scene";
import type {RendererGeometry} from "../gpuMemoryManager";

export interface RendererMesh {
  mesh: SceneMesh;
  sceneModel: SceneModel | null;
  geometryState: RendererGeometry;
  worldMatrix: Mat4;
  matrixDirty: boolean;
  instanceDataVersion: number;
  createdStructureVersion: number;
}
