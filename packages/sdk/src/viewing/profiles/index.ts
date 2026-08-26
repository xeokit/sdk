/**
 * # xeokit View Profiles
 *
 * Named rendering configurations for a View.
 *
 * This module provides {@link ViewProfiles}, a controller that applies
 * symbolic rendering profiles to a {@link viewing!viewer.View | View}. A
 * profile is a sparse map of View effects, lights and rendering controls to
 * the properties that should change for that rendering state.
 *
 * Use ViewProfiles when an application needs to switch between named visual
 * states, such as interactive navigation, engineering inspection and
 * presentation-quality rendering. Profiles are external to the View and to
 * individual effect classes, so effects remain ordinary View components with
 * writable properties. The profile controller decides which properties are
 * currently owned by a profile, captures the underlying runtime values, and
 * restores them when profile control is cleared or transferred.
 *
 * Profile activation treats `enabled` specially. While a profile is active,
 * only effects explicitly configured with `enabled: true` remain enabled.
 * Other properties remain sparse overrides: an omitted property is not
 * controlled by that profile.
 *
 * ## Quick Start
 *
 * ```ts
 * import {DEFAULT_VIEW_PROFILES, ViewProfiles} from "@xeokit/sdk/viewing/profiles";
 *
 * const profiles = new ViewProfiles(view, {
 *   profiles: DEFAULT_VIEW_PROFILES,
 *   activeProfile: "realistic"
 * });
 *
 * profiles.setActiveProfile("fast");
 * ```
 *
 * {@link viewing!adaptiveQuality.AdaptiveQuality | AdaptiveQuality} can drive
 * a ViewProfiles instance, normally selecting a low-cost profile while the
 * camera is moving and a higher-quality profile when the View is at rest.
 *
 * ## Built-in Profiles
 *
 * {@link DEFAULT_VIEW_PROFILES} provides:
 *
 * - `"fast"`: lowest-cost interactive profile. Disables SAO, edges, bloom,
 *   atmosphere, IBL, shadows and antialiasing, and enables resolution scale
 *   reduction.
 * - `"detailed"`: engineering readability profile. Enables subtle SAO,
 *   soft mesh-colored edges and SMAA while keeping lighting close to
 *   `"realistic"`.
 * - `"realistic"`: quality profile. Enables IBL, sky, subtle SAO,
 *   restrained bloom, atmosphere and cast shadows, with low hemisphere
 *   intensity to avoid washed-out lighting.
 *
 * @module profiles
 */
export {DEFAULT_VIEW_PROFILES} from "./DefaultViewProfiles";
export {ViewProfiles} from "./ViewProfiles";
export type {
  DefaultViewProfileId,
  DefaultViewProfiles
} from "./DefaultViewProfiles";
export type {
  ViewEffectProperties,
  ViewProfile,
  ViewProfileEffectId,
  ViewProfileEffectParams,
  ViewProfilesParams
} from "./ViewProfilesParams";
