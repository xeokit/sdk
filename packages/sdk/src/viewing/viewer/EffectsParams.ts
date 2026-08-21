import type {SAOParams} from "./SAOParams";
import type {EdgesParams} from "./EdgesParams";
import type {BloomParams} from "./BloomParams";
import type {AtmosphereParams} from "./AtmosphereParams";
import type {DepthOfFieldParams} from "./DepthOfFieldParams";
import type {ColorGradingParams} from "./ColorGradingParams";
import type {TonemapParams} from "./TonemapParams";
import type {AntiAliasingParams} from "./AntiAliasingParams";
import type {ShadowsParams} from "./ShadowsParams";
import type {SkyParams} from "./SkyParams";
import type {IBLParams} from "./IBLParams";
import type {SectionPlaneCapsParams} from "./SectionPlaneCapsParams";
import type {BodyHatchParams} from "./BodyHatchParams";


/**
 * Parameters for an {@link Effects} component.
 *
 * * Located at {@link ViewParams.effects}.
 *
 * Aggregates the View's renderer effects — Scalable Ambient
 * Obscurance, edge enhancement, HDR bloom, atmospheric attenuation,
 * depth of field, color grading, the HDR tonemap pass, antialiasing, and
 * directional shadow mapping. Each entry is optional; when omitted the
 * component falls back to its own constructor defaults.
 */
export interface EffectsParams {

  /**
   * Parameters for the View's Scalable Ambient Obscurance pass,
   * {@link SAO} — accessible at {@link Effects.sao}.
   */
  sao?: SAOParams;

  /**
   * Parameters for the View's edge enhancement effect,
   * {@link Edges} — accessible at {@link Effects.edges}.
   */
  edges?: EdgesParams;

  /**
   * Parameters for the View's HDR bloom post-process,
   * {@link Bloom} — accessible at {@link Effects.bloom}.
   */
  bloom?: BloomParams;

  /**
   * Parameters for the View's HDR atmospheric attenuation post-process,
   * {@link Atmosphere} — accessible at {@link Effects.atmosphere}.
   *
   * Omit to leave the component inactive.
   */
  atmosphere?: AtmosphereParams;

  /**
   * Parameters for the View's HDR depth-of-field post-process,
   * {@link DepthOfField} — accessible at
   * {@link Effects.depthOfField}.
   *
   * Omit to leave the component inactive.
   */
  depthOfField?: DepthOfFieldParams;

  /**
   * Parameters for the View's display-space color grading pass,
   * {@link ColorGrading} — accessible at
   * {@link Effects.colorGrading}.
   *
   * Omit to leave the component inactive.
   */
  colorGrading?: ColorGradingParams;

  /**
   * Parameters for the View's HDR tonemap pass,
   * {@link Tonemap} — accessible at {@link Effects.tonemap}.
   */
  tonemap?: TonemapParams;

  /**
   * Parameters for the View's final antialiasing pass,
   * {@link AntiAliasing} — accessible at
   * {@link Effects.antiAliasing}.
   */
  antiAliasing?: AntiAliasingParams;

  /**
   * Parameters for the View's directional shadow mapping,
   * {@link Shadows} — accessible at {@link Effects.shadows}.
   */
  shadows?: ShadowsParams;

  /**
   * Parameters for the View's procedural-sky background,
   * {@link Sky} — accessible at {@link Effects.sky}. Drives the
   * shared {@link SkyRenderer}'s draw on every frame this View is
   * rendered.
   */
  sky?: SkyParams;

  /**
   * Parameters for the View's stencil-based section-plane caps,
   * {@link SectionPlaneCaps} — accessible at
   * {@link Effects.sectionPlaneCaps}.
   *
   * Defaults to off so callers can supply their own cap
   * geometry without paying the stencil-pass cost.
   */
  sectionPlaneCaps?: SectionPlaneCapsParams;

  /**
   * Parameters for the View's hatched-Lambert body shading,
   * {@link BodyHatch} — accessible at {@link Effects.bodyHatch}.
   *
   */
  bodyHatch?: BodyHatchParams;

  /**
   * Parameters for the View's image-based lighting,
   * {@link IBL} — accessible at {@link Effects.ibl} (alias of
   * {@link Lights.ibl}). Surfaced under effects so reflective UIs
   * group IBL with the other renderer-effect components whose
   * look it drives, while the underlying instance still lives on
   * {@link Lights}. {@link LightsParams.ibl} remains supported for
   * construction-time configuration.
   */
  ibl?: IBLParams;
}
