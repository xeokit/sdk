import type {AntiAliasingParams} from "../viewer/AntiAliasingParams";
import type {AtmosphereParams} from "../viewer/AtmosphereParams";
import type {BloomParams} from "../viewer/BloomParams";
import type {BodyHatchParams} from "../viewer/BodyHatchParams";
import type {DepthOfFieldParams} from "../viewer/DepthOfFieldParams";
import type {EdgesParams} from "../viewer/EdgesParams";
import type {HemisphereAmbientParams} from "../viewer/HemisphereAmbientParams";
import type {IBLParams} from "../viewer/IBLParams";
import type {ResolutionScaleParams} from "../viewer/ResolutionScaleParams";
import type {SAOParams} from "../viewer/SAOParams";
import type {SectionPlaneCapsParams} from "../viewer/SectionPlaneCapsParams";
import type {ShadowsParams} from "../viewer/ShadowsParams";
import type {SkyParams} from "../viewer/SkyParams";
import type {TexturingParams} from "../viewer/TexturingParams";
import type {TonemapParams} from "../viewer/TonemapParams";

/**
 * Opt-in map from ViewProfiles effect IDs to the corresponding params types.
 *
 * Each property is optional because a profile only lists the View components it
 * configures. When a property is present, its value must be the params type for
 * that component. `toneMap` is accepted as a compatibility alias at runtime,
 * but `tonemap` is the canonical key emitted by serialization.
 */
export type ViewProfileEffectParams = {
  /** Screen-space ambient occlusion. */
  sao?: SAOParams;
  /** Mesh edge enhancement. */
  edges?: EdgesParams;
  /** Bloom post-processing. */
  bloom?: BloomParams;
  /** Atmospheric distance haze. */
  atmosphere?: AtmosphereParams;
  /** Depth-of-field post-processing. */
  depthOfField?: DepthOfFieldParams;
  /** HDR tonemapping. */
  tonemap?: TonemapParams;
  /** Post-process antialiasing. */
  antiAliasing?: AntiAliasingParams;
  /** Shadow mapping. */
  shadows?: ShadowsParams;
  /** Procedural sky background. */
  sky?: SkyParams;
  /** Section-plane cap rendering. */
  sectionPlaneCaps?: SectionPlaneCapsParams;
  /** Body hatch rendering. */
  bodyHatch?: BodyHatchParams;
  /** Image-based lighting. */
  ibl?: IBLParams;
  /** Analytical hemisphere ambient lighting. */
  hemispheric?: HemisphereAmbientParams;
  /** Texture visibility. */
  texturing?: TexturingParams;
  /** Backing-buffer resolution scale. */
  resolutionScale?: ResolutionScaleParams;
};

/**
 * Canonical effect IDs accepted by `ViewProfiles`.
 */
export type ViewProfileEffectId = keyof ViewProfileEffectParams;

/**
 * Sparse property map for View effects and lighting components.
 *
 * Each effect entry is typed as that effect's existing params type. For
 * example, `ibl` accepts {@link viewing!viewer.IBLParams} properties, while
 * `sao` accepts {@link viewing!viewer.SAOParams} properties. The params types
 * are sparse configuration objects, so callers may still provide only the
 * properties they want the profile to control.
 *
 * `toneMap` is accepted as an input alias for `tonemap`; values are normalized
 * to `tonemap` internally and in serialized output.
 */
export type ViewEffectProperties = ViewProfileEffectParams & {
  toneMap?: TonemapParams;
};

/**
 * Symbolic View profile.
 *
 * Uses the same two-level shape as {@link ViewEffectProperties}. When a
 * profile is active, `enabled` has closed-world semantics: only effects
 * explicitly declaring `enabled: true` are enabled.
 */
export type ViewProfile = ViewEffectProperties;

/**
 * Parameters for {@link ViewProfiles}.
 */
export interface ViewProfilesParams {
  /**
   * Profile registry keyed by application-defined profile ID.
   *
   * Profile definitions are cloned when loaded into {@link ViewProfiles}.
   */
  profiles?: Record<string, ViewProfile>;

  /**
   * Initially active profile ID. Use `null` or omit this property to leave the
   * View outside profile control.
   */
  activeProfile?: string | null;
}
