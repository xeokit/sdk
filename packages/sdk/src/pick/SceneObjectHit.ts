import type {MeshHit} from "./MeshHit";
import type {SceneObject} from "../scene";

/**
 * Represents a picked {@link scene!SceneObject | SceneObject} within a {@link RayPickResult}.
 *
 * See {@link pick | @xeokit/sdk/pick} for usage.
 */
export interface SceneObjectHit {

  /**
   * The {@link scene!SceneObject | SceneObject} that was picked.
   */
  sceneObject: SceneObject;

  /**
   * Represents the {@link scene!SceneMesh | Meshes} within the picked {@link scene!SceneObject | SceneObject} that intersect the picking ray.
   */
  meshHits: MeshHit[];
}
