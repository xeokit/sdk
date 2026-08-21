import type {EffectsParams} from "./EffectsParams";
import type {View} from "./View";
import {SAO} from "./SAO";
import {Edges} from "./Edges";
import {Bloom} from "./Bloom";
import {Atmosphere} from "./Atmosphere";
import {DepthOfField} from "./DepthOfField";
import {ColorGrading} from "./ColorGrading";
import {Tonemap} from "./Tonemap";
import {AntiAliasing} from "./AntiAliasing";
import {Shadows} from "./Shadows";
import {Sky} from "./Sky";
import {SectionPlaneCaps} from "./SectionPlaneCaps";
import {BodyHatch} from "./BodyHatch";
import type {IBL} from "./IBL";


/**
 * Aggregates the renderer-effect components for a {@link viewing!viewer.View | View}.
 *
 * * Located at {@link View.effects}.
 *
 * Holds:
 *
 *   - {@link Effects.sao} — Scalable Ambient Obscurance, the
 *     screen-space ambient-occlusion pass that grounds objects
 *     against each other.
 *   - {@link Effects.edges} — wireframe-style edge enhancement
 *     drawn on top of object silhouettes.
 *   - {@link Effects.bloom} — HDR bloom post-process picking up
 *     bright pixels and bleeding them into the surroundings.
 *   - {@link Effects.atmosphere} — HDR atmospheric attenuation post-process
 *     that fades distant geometry toward a haze colour.
 *   - {@link Effects.depthOfField} — HDR depth-of-field post-process
 *     that keeps the focus distance sharp and blurs nearer/farther pixels.
 *   - {@link Effects.colorGrading} — display-space grading applied after
 *     tonemap and before sRGB encoding.
 *   - {@link Effects.tonemap} — the HDR tonemap pass that flattens
 *     the linear-HDR framebuffer into displayable sRGB.
 *   - {@link Effects.antiAliasing} — final antialiasing pass.
 *   - {@link Effects.shadows} — directional shadow mapping driven
 *     by the View's primary sun direction.
 */
class Effects {

  /**
   * The View these Effects belong to.
   */
  public readonly view: View;

  /**
   * Scalable Ambient Obscurance pass for this View.
   */
  public readonly sao: SAO;

  /**
   * Edge enhancement effect for this View.
   */
  public readonly edges: Edges;

  /**
   * HDR bloom post-process for this View.
   */
  public readonly bloom: Bloom;

  /**
   * HDR atmospheric attenuation post-process for this View.
   */
  public readonly atmosphere: Atmosphere;

  /**
   * HDR depth-of-field post-process for this View.
   */
  public readonly depthOfField: DepthOfField;

  /**
   * Display-space color grading pass for this View.
   */
  public readonly colorGrading: ColorGrading;

  /**
   * HDR tonemap pass for this View.
   */
  public readonly tonemap: Tonemap;

  /**
   * Final antialiasing pass for this View.
   */
  public readonly antiAliasing: AntiAliasing;

  /**
   * Directional shadow mapping for this View.
   */
  public readonly shadows: Shadows;

  /**
   * Procedural-sky background controls for this View — sun
   * direction, sky / horizon / ground colours, and the sun
   * disc + glow. {@link presentations!sunStudy.SunStudy | SunStudy}
   * drives `sky.sunDirection` (and `sky.sunColor` / `sky.sunEnabled`)
   * automatically when its `driveSky` option is set.
   */
  public readonly sky: Sky;

  /**
   * Stencil-based section-plane caps for this View.
   *
   * When applied, the renderer fills the cross-section
   * surfaces of clipped objects with the per-plane
   * {@link SectionPlane.capColor}. Defaults to off — callers
   * who want their own cap geometry just leave it off.
   */
  public readonly sectionPlaneCaps: SectionPlaneCaps;

  /**
   * Surface body-hatch (engineering / schematic) shading for
   * this View. When applied, opaque triangle batches render
   * via the un-textured Lambert variant and the material's
   * {@link SceneMaterial.hatchPattern} overlays the body.
   */
  public readonly bodyHatch: BodyHatch;

  /**
   * Image-Based Lighting for this View.
   *
   * Alias of {@link Lights.ibl | view.lights.ibl} — same instance,
   * surfaced here so reflective UIs (the Studio View Panel) can
   * group it with the renderer effects whose look it controls.
   */
  get ibl(): IBL {
    return this.view.lights.ibl;
  }

  /**
   * @private
   */
  constructor(view: View, params: EffectsParams = {}) {
    this.view = view;
    this.sao          = new SAO         (view, params.sao          || {});
    this.edges        = new Edges       (view, params.edges        || {});
    this.bloom        = new Bloom       (view, params.bloom        || {});
    this.atmosphere   = new Atmosphere  (view, params.atmosphere !== undefined ? params.atmosphere : {enabled: false});
    this.depthOfField = new DepthOfField(view, params.depthOfField !== undefined ? params.depthOfField : {enabled: false});
    this.colorGrading = new ColorGrading(view, params.colorGrading !== undefined ? params.colorGrading : {enabled: false});
    this.tonemap      = new Tonemap     (view, params.tonemap      || {});
    this.antiAliasing = new AntiAliasing(view, params.antiAliasing || {});
    this.shadows      = new Shadows     (view, params.shadows      || {});
    // Sky defaults match the SkyRenderer's prior built-in values
    // — palette matches what the renderer used to bake in, so
    // any existing caller sees identical pixels when `sky` is
    // left at its default.
    this.sky          = new Sky         (view, params.sky          || {});
    // Section-plane caps default off — the stencil pass adds
    // ~2 model renders per cap-enabled plane, so the caller opts in.
    this.sectionPlaneCaps = new SectionPlaneCaps(view, params.sectionPlaneCaps || {});

    this.bodyHatch = new BodyHatch(view, params.bodyHatch || {});
  }
}

export {Effects};
