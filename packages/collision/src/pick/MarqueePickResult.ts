import {SceneObject} from "@xeokit/scene";

/**
 * Results returned by {@link marqueePick}.
 */
export interface MarqueePickResult {

    /**
     * Contains the SceneObjects that were marquee-picked.
     */
    sceneObjects: SceneObject[];
}
