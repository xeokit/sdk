import type {SAOParams} from "./SAOParams";
import type {EdgesParams} from "./EdgesParams";
import type {BloomParams} from "./BloomParams";
import type {TonemapParams} from "./TonemapParams";
import type {AntiAliasingParams} from "./AntiAliasingParams";
import type {ShadowsParams} from "./ShadowsParams";
import type {SkyParams} from "./SkyParams";


/**
 * Parameters for an {@link Effects} component.
 *
 * * Located at {@link ViewParams.effects}.
 *
 * Aggregates the View's renderer effects — Scalable Ambient
 * Obscurance, edge enhancement, HDR bloom, the HDR tonemap pass,
 * antialiasing, and directional shadow mapping. Each entry is
 * optional; when omitted the component falls back to its own
 * constructor defaults.
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
  sectionPlaneCaps?: { renderModes?: number[] };

  /**
   * Parameters for the View's hatched-Lambert body shading,
   * {@link BodyHatch} — accessible at {@link Effects.bodyHatch}.
   *
   * Default `renderModes`: `[DetailedRender]`. The PBR-textured
   * path runs in every other mode; this one swaps in the
   * un-textured Lambert variant so the material's hatch pattern
   * dominates the body.
   */
  bodyHatch?: { renderModes?: number[] };
}
