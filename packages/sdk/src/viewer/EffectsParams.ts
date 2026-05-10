import type {SAOParams} from "./SAOParams";
import type {EdgesParams} from "./EdgesParams";
import type {BloomParams} from "./BloomParams";
import type {TonemapParams} from "./TonemapParams";
import type {AntiAliasingParams} from "./AntiAliasingParams";
import type {ShadowsParams} from "./ShadowsParams";


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
}
