import type {LightsParams} from "./LightsParams";
import type {View} from "./View";
import {HemisphereAmbient} from "./HemisphereAmbient";
import {IBL} from "./IBL";


/**
 * Aggregates the environment-illumination components for a {@link viewing!viewer.View | View}.
 *
 * * Located at {@link View.lights}.
 *
 * Holds:
 *
 *   - {@link Lights.ibl} — cubemap-based image-based lighting, the
 *     prefiltered environment that drives the diffuse + GGX-specular
 *     contribution to each fragment's BRDF.
 *   - {@link Lights.hemispheric} — analytical sky/ground/up gradient
 *     ambient that cheaply lifts the flat ambient floor.
 *
 * Both effects stack additively when enabled. Use
 * {@link viewing!viewProfiles.ViewProfiles | ViewProfiles} when an
 * application needs profile-specific IBL/hemisphere balance.
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
