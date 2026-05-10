import type {LightsParams} from "./LightsParams";
import type {View} from "./View";
import {HemisphereAmbient} from "./HemisphereAmbient";
import {IBL} from "./IBL";


/**
 * Aggregates the environment-illumination components for a {@link View}.
 *
 * * Located at {@link View.lights}.
 *
 * Holds:
 *
 *   - {@link Lights.ibl} — cubemap-based image-based lighting, the
 *     prefiltered environment that drives the diffuse + GGX-specular
 *     contribution to each fragment's BRDF.
 *   - {@link Lights.hemispheric} — analytical sky/ground/up gradient
 *     ambient that lifts the flat ambient floor in every render mode
 *     by default.
 *
 * Both effects stack additively when their respective render-mode
 * sets overlap. The cubemap is the heavyweight, physically-based
 * path; the hemisphere is the cheap analytical fallback.
 */
class Lights {

  /**
   * The View to which these Lights belong.
   */
  public readonly view: View;

  /**
   * Cubemap image-based lighting for this View.
   */
  public readonly ibl: IBL;

  /**
   * Analytical hemisphere ambient term for this View.
   */
  public readonly hemispheric: HemisphereAmbient;

  /**
   * @private
   */
  constructor(view: View, params: LightsParams = {}) {
    this.view = view;
    this.ibl = new IBL(view, params.ibl || {});
    this.hemispheric = new HemisphereAmbient(view, params.hemispheric || {});
  }
}

export {Lights};
