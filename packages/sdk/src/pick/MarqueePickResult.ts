import type {SceneObject} from "../scene";

/**
 * Marquee picking results returned by {@link Picker.marqueePick | Picker.marqueePick}.
 *
 * See {@link pick | @xeokit/sdk/pick} for usage.
 */
export interface MarqueePickResult {

  /**
   * Contains the SceneObjects that were marquee-picked.
   */
  sceneObjects: SceneObject[];
}
