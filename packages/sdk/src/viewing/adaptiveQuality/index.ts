/**
 * # xeokit Adaptive Quality
 *
 * ---
 *
 * **Switches a {@link viewing!viewProfiles.ViewProfiles | ViewProfiles}
 * component to a low-cost profile while the camera is moving, then restores
 * quality once it settles.**
 *
 * ---
 *
 * The mechanism is a profile switch on `ViewProfiles`. Profiles decide the
 * final `enabled` state and sparse configuration overrides for effects such
 * as SAO, shadows, bloom, tonemap, antialiasing, IBL, and resolution scale.
 *
 * `AdaptiveQuality` listens for camera changes: the first change in a burst
 * selects the low-cost profile (default `"fast"`), and a trailing timer
 * selects the quality profile (default `"realistic"`) once the camera has
 * been still long enough.
 *
 * ## Quick Start
 *
 * ```ts
 * import {AdaptiveQuality} from "@xeokit/sdk/viewing/adaptiveQuality";
 *
 * const aq = new AdaptiveQuality({viewProfiles});
 * // …
 * aq.destroy();
 * ```
 *
 * @module adaptiveQuality
 */
export {AdaptiveQuality, type AdaptiveQualityParams} from "./AdaptiveQuality";
