import type {HemisphereAmbientParams} from "./HemisphereAmbientParams";
import type {View} from "./View";
import {createVec3Float64, type Vec3, type Vec3Float} from "../../base/math/vector";
import {SDKErrorType, type SDKResult} from "../../base/core";
import {DetailedRender, NavigationRender, RealisticRender} from "../../base/constants";


/**
 * Configures the analytical hemisphere ambient term for a {@link viewing!viewer.View | View}.
 *
 * * Located at {@link Lights.hemispheric}, which lives at {@link View.lights}.
 *
 * The renderer evaluates an ambient irradiance term per fragment by
 * lerping between {@link HemisphereAmbient.skyColor} and
 * {@link HemisphereAmbient.groundColor} based on how much the
 * fragment's normal faces world up vs. world down. No cubemap
 * textures, no specular reflections, no prefiltering — just a smooth
 * two-colour gradient that lifts the flat ambient floor whenever the
 * active {@link View.renderMode} is in
 * {@link HemisphereAmbient.renderModes}.
 *
 * Cheap: two uniforms and one `mix` + `dot` per fragment. Default-on
 * across all three render modes so {@link base!constants.NavigationRender |
 * NavigationRender} and {@link base!constants.DetailedRender |
 * DetailedRender} pick up the same directional fill that
 * {@link base!constants.RealisticRender | RealisticRender} gets from full
 * IBL — closing the brightness gap between modes.
 *
 * Stacks with {@link IBL} when both apply in the same render mode:
 * the cubemap diffuse contribution adds on top of the analytical
 * hemisphere. Tune {@link HemisphereAmbient.intensity} per scene to
 * keep the combined ambient at the level you want.
 */
class HemisphereAmbient {

  /**
   * The View to which this HemisphereAmbient belongs.
   */
  public readonly view: View;

  #renderModes: number[];
  #intensity: number;
  #skyColor: Vec3Float;
  #groundColor: Vec3Float;
  #worldUp: Vec3Float;
  #destroyed: boolean = false;

  /**
   * @private
   */
  constructor(view: View, params: HemisphereAmbientParams = {}) {
    this.view = view;
    this.#renderModes = params.renderModes ?? [NavigationRender, DetailedRender, RealisticRender];
    this.#intensity = params.intensity !== undefined ? params.intensity : 1.0;
    this.#skyColor = createVec3Float64(params.skyColor || [0.62, 0.72, 0.86]);
    this.#groundColor = createVec3Float64(params.groundColor || [0.42, 0.36, 0.30]);
    this.#worldUp = createVec3Float64(params.worldUp || [0, 0, 1]);
  }

  /**
   * Sets which rendering modes in which to apply the hemisphere
   * ambient term.
   *
   * Default value is `[NavigationRender, DetailedRender,
   * RealisticRender]`.
   */
  set renderModes(value: number[]) {
    this.#renderModes = value;
    this.view.needsRender();
  }

  /**
   * Gets which rendering modes in which to apply the hemisphere
   * ambient term.
   *
   * Default value is `[NavigationRender, DetailedRender,
   * RealisticRender]`.
   */
  get renderModes(): number[] {
    return this.#renderModes;
  }

  /**
   * Returns true if the hemisphere ambient term is currently possible
   * given the View's state. Always `true` — the term is analytical and
   * has no GPU-feature dependencies.
   * @private
   */
  get possible(): boolean {
    return true;
  }

  /**
   * Gets if the hemisphere ambient term is currently applied.
   *
   * This is `true` when {@link View.renderMode | View.renderMode} is
   * in {@link HemisphereAmbient.renderModes}.
   */
  get applied(): boolean {
    for (let i = 0, len = this.#renderModes.length; i < len; i++) {
      if (this.view.renderMode === this.#renderModes[i]) {
        return true;
      }
    }
    return false;
  }

  /**
   * Sets the hemisphere ambient contribution multiplier. Range
   * `[0, ∞)`. Has no effect when the active {@link View.renderMode}
   * isn't in {@link HemisphereAmbient.renderModes}.
   *
   * Default value is `1.0`.
   */
  set intensity(value: number) {
    if (typeof value !== "number") return;
    if (this.#intensity === value) return;
    this.#intensity = value;
    this.view.needsRender();
  }

  /**
   * Gets the hemisphere ambient contribution multiplier.
   */
  get intensity(): number {
    return this.#intensity;
  }

  /**
   * Sets the linear-space RGB colour the renderer returns for normals
   * facing world up.
   *
   * Default value is `[0.62, 0.72, 0.86]`.
   */
  set skyColor(value: Vec3) {
    if (!value || value.length < 3) {
      this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[HemisphereAmbient set skyColor] Invalid colour parameter."
      });
      return;
    }
    const c = this.#skyColor;
    if (c[0] === value[0] && c[1] === value[1] && c[2] === value[2]) return;
    c[0] = value[0]; c[1] = value[1]; c[2] = value[2];
    this.view.needsRender();
  }

  /**
   * Gets the linear-space RGB sky colour.
   */
  get skyColor(): Vec3 {
    return this.#skyColor;
  }

  /**
   * Sets the linear-space RGB colour the renderer returns for normals
   * facing world down.
   *
   * Default value is `[0.42, 0.36, 0.30]`.
   */
  set groundColor(value: Vec3) {
    if (!value || value.length < 3) {
      this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[HemisphereAmbient set groundColor] Invalid colour parameter."
      });
      return;
    }
    const c = this.#groundColor;
    if (c[0] === value[0] && c[1] === value[1] && c[2] === value[2]) return;
    c[0] = value[0]; c[1] = value[1]; c[2] = value[2];
    this.view.needsRender();
  }

  /**
   * Gets the linear-space RGB ground colour.
   */
  get groundColor(): Vec3 {
    return this.#groundColor;
  }

  /**
   * Sets the world-space up axis used to weight the sky/ground sample.
   * Override for non-Z-up scenes (e.g. `[0, 1, 0]` for Y-up).
   *
   * Default value is `[0, 0, 1]`.
   */
  set worldUp(value: Vec3) {
    if (!value || value.length < 3) return;
    const c = this.#worldUp;
    if (c[0] === value[0] && c[1] === value[1] && c[2] === value[2]) return;
    c[0] = value[0]; c[1] = value[1]; c[2] = value[2];
    this.view.needsRender();
  }

  /**
   * Gets the world-space up axis.
   */
  get worldUp(): Vec3 {
    return this.#worldUp;
  }

  /**
   * Gets the current configuration of this HemisphereAmbient component.
   */
  toParams(): SDKResult<HemisphereAmbientParams> {
    return {
      ok: true,
      value: {
        renderModes: this.renderModes,
        intensity: this.intensity,
        skyColor: <Vec3>Array.from(this.skyColor),
        groundColor: <Vec3>Array.from(this.groundColor),
        worldUp: <Vec3>Array.from(this.worldUp)
      }
    };
  }

  /**
   * Configures this HemisphereAmbient component from a params object.
   */
  fromParams(params: HemisphereAmbientParams): SDKResult<void> {
    if (this.#destroyed) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[HemisphereAmbient.fromParams] HemisphereAmbient has been destroyed."
      });
    }
    if (params.renderModes !== undefined) this.renderModes = params.renderModes;
    if (params.intensity !== undefined)   this.intensity   = params.intensity;
    if (params.skyColor !== undefined)    this.skyColor    = <Vec3>Array.from(params.skyColor);
    if (params.groundColor !== undefined) this.groundColor = <Vec3>Array.from(params.groundColor);
    if (params.worldUp !== undefined)     this.worldUp     = <Vec3>Array.from(params.worldUp);
    return { ok: true, value: undefined };
  }

  /**
   * @private
   */
  destroy() {
    this.#destroyed = true;
  }
}

export {HemisphereAmbient};
