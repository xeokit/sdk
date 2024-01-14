import type {SceneObject} from "@xeokit/scene";
import type {MeshHit} from "./MeshHit";

/**
 * Represents a picked {@link @xeokit/scene!SceneObject | SceneObject} within a {@link RayPickResult}.
 *
 * See {@link "@xeokit/collision!pick"} for usage.
 */
export interface SceneObjectHit {

    /**
     * The {@link @xeokit/scene!SceneObject | SceneObject} that was picked.
     */
    sceneObject: SceneObject;

    /**
     * Represents the {@link @xeokit/scene!SceneMesh | Meshes} within the picked {@link @xeokit/scene!SceneObject | SceneObject} that intersect the picking ray.
     */
    meshHits: MeshHit[];
}