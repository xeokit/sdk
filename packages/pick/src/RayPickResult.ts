import type {SceneObjectHit} from "./SceneObjectHit";

/**
 * Ray picking results returned by {@link rayPick}.
 *
 * See {@link "@xeokit/collision!pick"} for usage.
 */
export interface RayPickResult {

    /**
     * Represents the SceneObjects that were picked by the ray, along with
     * the elements within them that intersect with the ray, and the intersection coordinates on those elements.
     */
    sceneObjectHits: SceneObjectHit[]
}


