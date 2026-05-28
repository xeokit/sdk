import type {EffectsParams} from "./EffectsParams";
import type {View} from "./View";
import {SAO} from "./SAO";
import {Edges} from "./Edges";
import {Bloom} from "./Bloom";
import {Tonemap} from "./Tonemap";
import {AntiAliasing} from "./AntiAliasing";
import {Shadows} from "./Shadows";
import {Sky} from "./Sky";
import {SectionPlaneCaps} from "./SectionPlaneCaps";
import {BodyHatch} from "./BodyHatch";
import {DetailedRender, RealisticRender} from "../../base/constants";


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
 *   - {@link Effects.tonemap} — the HDR tonemap pass that flattens
 *     the linear-HDR framebuffer into displayable sRGB.
 *   - {@link Effects.antiAliasing} — final antialiasing pass.
 *   - {@link Effects.shadows} — directional shadow mapping driven
 *     by the View's primary sun direction.
 *
 * Each effect declares which {@link View.renderMode} presets it
 * fires under via its own `renderModes`; the aggregate component
 * simply owns the lifetimes.
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
   * Defaults to {@link base!constants.DetailedRender | DetailedRender}
   * so engineering presets get the schematic look automatically;
   * Realistic stays PBR.
   */
  public readonly bodyHatch: BodyHatch;

  /**
   * @private
   */
  constructor(view: View, params: EffectsParams = {}) {
    this.view = view;
    this.sao          = new SAO         (view, params.sao          || {});
    // Edges default — black, fully-opaque, single-pixel, only in
    // DetailedRender. Preserved from the prior View-construction
    // defaults so callers that don't pass `edges` see no change.
    this.edges        = new Edges       (view, params.edges        || {
      edgeColor:   [0.0, 0.0, 0.0],
      edgeAlpha:   1.0,
      edgeWidth:   1,
      renderModes: [DetailedRender],
    });
    this.bloom        = new Bloom       (view, params.bloom        || {});
    this.tonemap      = new Tonemap     (view, params.tonemap      || {});
    this.antiAliasing = new AntiAliasing(view, params.antiAliasing || {});
    // Shadows defaulted to RealisticRender to match the prior
    // View-construction behaviour — preserved here so callers that
    // don't pass `shadows` still see the same mode-gated behaviour.
    this.shadows      = new Shadows     (view, params.shadows      || {renderModes: [RealisticRender]});
    // Sky defaults match the SkyRenderer's prior built-in values
    // — palette matches what the renderer used to bake in, so
    // any existing caller sees identical pixels when `sky` is
    // left at its default.
    this.sky          = new Sky         (view, params.sky          || {});
    // Section-plane caps default off — the stencil pass adds
    // ~2 model renders per cap-enabled plane, so the caller
    // opts in either by passing `sectionPlaneCaps` here or by
    // assigning `view.effects.sectionPlaneCaps.renderModes` later.
    this.sectionPlaneCaps = new SectionPlaneCaps(view, params.sectionPlaneCaps || {});

    // Body hatch defaults to [DetailedRender] — engineering /
    // schematic body shading without the caller wiring anything.
    // Override per-view by passing `bodyHatch` here or via
    // `view.effects.bodyHatch.renderModes`.
    this.bodyHatch = new BodyHatch(view, params.bodyHatch || {});
  }
}

export {Effects};
