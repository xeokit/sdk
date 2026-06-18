/**
 * # xeokit Adaptive Quality
 *
 * ---
 *
 * **Drops a {@link viewing!viewer.View | View} into a cheap
 * render mode while the camera is moving, restoring quality once it
 * settles.**
 *
 * ---
 *
 * The mechanism is one line of state: `view.renderMode`. Each renderer
 * effect (SAO, shadows, bloom, FXAA, ACES tonemap, edges, IBL, section
 * caps) declares its own `renderModes` list and gates its activation on
 * `view.renderMode` being in that list. Flipping the View's mode
 * therefore toggles every effect whose list doesn't include the new mode
 * — no per-effect setup needed here.
 *
 * `AdaptiveQuality` listens for camera changes and drives that flip:
 * the first change in a burst switches the View into a low-cost mode
 * (default {@link base!constants.NavigationRender | NavigationRender}),
 * and a trailing timer flips it back to a high-quality mode (default
 * {@link base!constants.RealisticRender | RealisticRender}) once the
 * camera has been still long enough.
 *
 * ## Quick Start
 *
 * ```ts
 * import {AdaptiveQuality} from "@xeokit/sdk/viewing/adaptiveQuality";
 *
 * const aq = new AdaptiveQuality({view});
 * // …
 * aq.destroy();
 * ```
 *
 * @module viewing/adaptiveQuality
 */
export {AdaptiveQuality, type AdaptiveQualityParams} from "./AdaptiveQuality";
