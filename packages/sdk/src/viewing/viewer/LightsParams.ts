import type {HemisphereAmbientParams} from "./HemisphereAmbientParams";
import type {IBLParams} from "./IBLParams";


/**
 * Parameters for a {@link Lights} component.
 *
 * * Located at {@link ViewParams.lights}.
 *
 * Aggregates the View's environment-illumination components — the
 * cubemap-based {@link IBL} and the analytical
 * {@link HemisphereAmbient | hemispheric ambient}. Both are optional
 * and fall back to their own constructor defaults when omitted.
 */
export interface LightsParams {

  /**
   * Parameters for the View's cubemap image-based lighting,
   * {@link IBL} — accessible at {@link Lights.ibl}.
   */
  ibl?: IBLParams;

  /**
   * Parameters for the View's analytical hemisphere ambient term,
   * {@link HemisphereAmbient} — accessible at {@link Lights.hemispheric}.
   */
  hemispheric?: HemisphereAmbientParams;
}
