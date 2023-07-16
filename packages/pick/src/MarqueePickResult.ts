import type {SceneObject} from "@xeokit/scene";

/**
 * Marquee picking results returned by {@link marqueePick}.
 *
 * See {@link "@xeokit/collision!pick"} for usage.
 */
export interface MarqueePickResult {

    /**
     * Contains the SceneObjects that were marquee-picked.
     */
    sceneObjects: SceneObject[];
}
