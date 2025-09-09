import {Component, SDKError} from "../core";
import {CustomProjectionType, FastRender, FrustumProjectionType, QualityRender} from "../constants";
import {type SAOParams} from "./SAOParams";
import type {View} from "./View";

/**
 * Configures Scalable Ambient Obscurance (SAO) for a {@link View}.
 *
 * * Located at {@link View.sao}.
 * * View will apply SAO when {@link View.renderMode | View.renderMode} is set to one of the values
 * specified in {@link SAO.renderModes}.
 *
 * See {@link viewer | @xeokit/sdk/viewer} for usage info.
 */
export class SAO extends Component {

  /**
   * The View to which this SAO belongs.
   */
  public readonly view: View;

  #state: {
    renderModes: number[];
    intensity: number;
    minResolution: number;
    blendFactor: number;
    numSamples: number;
    bias: number;
    scale: number;
    blur: boolean;
    blendCutoff: number;
    kernelRadius: number;
  }

  /** @private */
  constructor(view: View, saoParams: SAOParams) {

    super(view, saoParams);

    this.view = view;

    this.#state = {
      renderModes: [QualityRender],
      kernelRadius: saoParams.kernelRadius || 100.0,
      intensity: (saoParams.intensity !== undefined) ? saoParams.intensity : 0.15,
      bias: (saoParams.bias !== undefined) ? saoParams.bias : 0.5,
      scale: (saoParams.scale !== undefined) ? saoParams.scale : 1.0,
      minResolution: (saoParams.minResolution !== undefined) ? saoParams.minResolution : 0.0,
      numSamples: (saoParams.numSamples !== undefined) ? saoParams.numSamples : 10,
      blur: !!(saoParams.blur),
      blendCutoff: (saoParams.blendCutoff !== undefined) ? saoParams.blendCutoff : 0.3,
      blendFactor: (saoParams.blendFactor !== undefined) ? saoParams.blendFactor : 1.0
    };
  }

  /**
   * Sets which rendering modes in which to apply SAO.
   *
   * The {@link View} will apply SAO whenever {@link View.renderMode} has been set one of these values.
   *
   * Default value is [{@link constants!QualityRender | QualityRender}].
   */
  set renderModes(value: number[]) {
    this.#state.renderModes = value;
    this.view.needsRender();
  }

  /**
   * Gets which rendering modes in which to apply SAO.
   *
   * The {@link View} will apply SAO whenever {@link View.renderMode} has been set one of these values.
   *
   * Default value is [{@link constants!QualityRender | QualityRender}].
   */
  get renderModes(): number[] {
    return this.#state.renderModes;
  }

  /**
   * Gets whether SAO is supported by this browser and GPU.
   *
   * Even when enabled, SAO will only work if supported.
   */
  get supported(): boolean {
    return false; //  this.view.viewer.renderer.getSAOSupported();
  }

  /**
   * Returns true if SAO is currently possible, where it is supported, enabled, and the current view state is compatible.
   * Called internally by renderers logic.
   * @private
   */
  get possible(): boolean {
    if (!this.supported) {
      return false;
    }
    const projectionType = this.view.camera.projectionType;
    if (projectionType === CustomProjectionType) {
      return false;
    }
    if (projectionType === FrustumProjectionType) {
      return false;
    }
    return true;
  }

  /**
   * Gets the maximum area that SAO takes into account when checking for possible occlusion for each fragment.
   *
   * Default value is ````100.0````.
   */
  get kernelRadius(): number {
    return this.#state.kernelRadius;
  }

  /**
   * Sets the maximum area that SAO takes into account when checking for possible occlusion for each fragment.
   *
   * Default value is ````100.0````.
   */
  set kernelRadius(value: number) {
    if (value === undefined || value === null) {
      value = 100.0;
    }
    if (this.#state.kernelRadius === value) {
      return;
    }
    this.#state.kernelRadius = value;
    this.view.needsRender();
  }

  /**
   * Gets the degree of darkening (ambient obscurance) produced by the SAO effect.
   *
   * Default value is ````0.15````.
   */
  get intensity(): number {
    return this.#state.intensity;
  }

  /**
   * Sets the degree of darkening (ambient obscurance) produced by the SAO effect.
   *
   * Default value is ````0.15````.
   */
  set intensity(value: number) {
    if (value === undefined || value === null) {
      value = 0.15;
    }
    if (this.#state.intensity === value) {
      return;
    }
    this.#state.intensity = value;
    this.view.needsRender();
  }

  /**
   * Gets the SAO bias.
   *
   * Default value is ````0.5````.
   */
  get bias(): number {
    return this.#state.bias;
  }

  /**
   * Sets the SAO bias.
   *
   * Default value is ````0.5````.
   */
  set bias(value: number) {
    if (value === undefined || value === null) {
      value = 0.5;
    }
    if (this.#state.bias === value) {
      return;
    }
    this.#state.bias = value;
    this.view.needsRender();
  }

  /**
   * Gets the SAO occlusion scale.
   *
   * Default value is ````1.0````.
   */
  get scale(): number {
    return this.#state.scale;
  }

  /**
   * Sets the SAO occlusion scale.
   *
   * Default value is ````1.0````.
   */
  set scale(value: number) {
    if (value === undefined || value === null) {
      value = 1.0;
    }
    if (this.#state.scale === value) {
      return;
    }
    this.#state.scale = value;
    this.view.needsRender();
  }

  /**
   * Gets the SAO minimum resolution.
   *
   * Default value is ````0.0````.
   */
  get minResolution(): number {
    return this.#state.minResolution;
  }

  /**
   * Sets the SAO minimum resolution.
   *
   * Default value is ````0.0````.
   */
  set minResolution(value: number) {
    if (value === undefined || value === null) {
      value = 0.0;
    }
    if (this.#state.minResolution === value) {
      return;
    }
    this.#state.minResolution = value;
    this.view.needsRender();
  }

  /**
   * Gets the number of SAO samples.
   *
   * Default value is ````10````.
   */
  get numSamples(): number {
    return this.#state.numSamples;
  }

  /**
   * Sets the number of SAO samples.
   *
   * Default value is ````10````.
   *
   * Update this sparingly, since it causes a shader recompile.
   */
  set numSamples(value: number) {
    if (value === undefined || value === null) {
      value = 10;
    }
    if (this.#state.numSamples === value) {
      return;
    }
    this.#state.numSamples = value;
    this.view.needsRender();
  }

  /**
   * Gets whether Guassian blur is enabled.
   *
   * Default value is ````true````.
   */
  get blur(): boolean {
    return this.#state.blur;
  }

  /**
   * Sets whether Guassian blur is enabled.
   *
   * Default value is ````true````.
   */
  set blur(value: boolean) {
    value = (value !== false);
    if (this.#state.blur === value) {
      return;
    }
    this.#state.blur = value;
    this.view.needsRender();
  }

  /**
   * Gets the SAO blend cutoff.
   *
   * Default value is ````0.3````.
   *
   * Normally you don't need to alter this.
   */
  get blendCutoff(): number {
    return this.#state.blendCutoff;
  }

  /**
   * Sets the SAO blend cutoff.
   *
   * Default value is ````0.3````.
   *
   * Normally you don't need to alter this.
   */
  set blendCutoff(value: number) {
    if (value === undefined || value === null) {
      value = 0.3;
    }
    if (this.#state.blendCutoff === value) {
      return;
    }
    this.#state.blendCutoff = value;
    this.view.needsRender();
  }

  /**
   * Gets the SAO blend scale.
   *
   * Default value is ````1.0````.
   *
   * Normally you don't need to alter this.
   */
  get blendFactor(): number {
    return this.#state.blendFactor;
  }

  /**
   * Sets the SAO blend factor.
   *
   * Default value is ````1.0````.
   *
   * Normally you don't need to alter this.
   */
  set blendFactor(value: number) {
    if (value === undefined || value === null) {
      value = 1.0;
    }
    if (this.#state.blendFactor === value) {
      return;
    }
    this.#state.blendFactor = value;
    this.view.needsRender();
  }

  /**
   * Gets if SAO is currently applied.
   *
   * This is `true` when {@link View.renderMode | View.renderMode} is
   * in {@link SAO.renderModes | SAO.renderModes}.
   */
  get applied(): boolean {
    for (let i = 0, len = this.#state.renderModes.length; i < len; i++) {
      if (this.view.renderMode === this.#state.renderModes[i]) {
        return true;
      }
    }
    return false;
  }

  /**
   * Gets the current configuration of this SAO.
   */
  toParams(): SAOParams {
    return {
      renderModes: this.renderModes,
      intensity: this.intensity,
      minResolution: this.minResolution,
      blendFactor: this.blendFactor,
      numSamples: this.numSamples,
      bias: this.bias,
      scale: this.scale,
      blur: this.blur,
      blendCutoff: this.blendCutoff,
      kernelRadius: this.kernelRadius
    };
  }

  /**
   * Configures this SAO.
   *
   * @param saoParams
   */
  fromParams(saoParams: SAOParams) {
    this.renderModes = saoParams.renderModes;
    this.intensity = saoParams.intensity;
    this.minResolution = saoParams.minResolution;
    this.blendFactor = saoParams.blendFactor;
    this.numSamples = saoParams.numSamples;
    this.bias = saoParams.bias;
    this.scale = saoParams.scale;
    this.blur = saoParams.blur;
    this.blendCutoff = saoParams.blendCutoff;
    this.kernelRadius = saoParams.kernelRadius;
  }

  /**
   * @private
   */
  destroy() {
    super.destroy();
  }
}
