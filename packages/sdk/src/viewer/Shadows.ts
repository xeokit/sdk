import {CustomProjectionType, FrustumProjectionType, RealisticRender} from "../constants";
import type {ShadowsParams} from "./ShadowsParams";
import type {View} from "./View";
import {SDKErrorType, type SDKResult} from "../core";
import type {FloatArrayParam} from "../math";

const DEFAULT_DIRECTION: [number, number, number] = [-0.5, -1.0, -0.3];

/**
 * Configures single-cascade directional shadow mapping for a {@link View}.
 *
 * * Located at {@link View.shadows}.
 * * View will cast shadows when {@link View.renderMode | View.renderMode} is set to one of the values
 *   specified in {@link Shadows.renderModes}.
 *
 * See {@link viewer | @xeokit/sdk/viewer} for usage info.
 */
export class Shadows {

  /**
   * The View to which this Shadows component belongs.
   */
  public readonly view: View;

  private _renderModes: number[];
  private _intensity: number;
  private _bias: number;
  private _projectionSize: number;
  private _lightDistance: number;
  private _resolution: number;
  private _direction: Float32Array<any>;
  private _autoFit: boolean;
  private _maxDistance: number;
  private _padding: number;
  private _pcfKernelSize: number;
  private _normalOffsetBias: number;
  private _slopeBias: number;
  private _cascadeCount: number;
  private _cascadeSplitLambda: number;
  private _destroyed = false;

  /** @private */
  constructor(view: View, params: ShadowsParams) {
    this.view = view;
    this._renderModes = params.renderModes !== undefined ? params.renderModes.slice() : [RealisticRender];
    this._intensity = params.intensity !== undefined ? params.intensity : 0.45;
    this._bias = params.bias !== undefined ? params.bias : 0.003;
    this._projectionSize = params.projectionSize !== undefined ? params.projectionSize : 30;
    this._lightDistance = params.lightDistance !== undefined ? params.lightDistance : 50;
    this._resolution = params.resolution !== undefined ? params.resolution : 2048;
    this._direction = new Float32Array(DEFAULT_DIRECTION);
    if (params.direction) {
      this._direction.set(params.direction as ArrayLike<number>);
    }
    normalizeInPlace(this._direction);
    this._autoFit = params.autoFit !== false;
    this._maxDistance = params.maxDistance !== undefined ? params.maxDistance : 200;
    this._padding = params.padding !== undefined ? params.padding : 1.1;
    this._pcfKernelSize = clampPcfKernelSize(params.pcfKernelSize !== undefined ? params.pcfKernelSize : 3);
    this._normalOffsetBias = params.normalOffsetBias !== undefined ? params.normalOffsetBias : 0.02;
    this._slopeBias = params.slopeBias !== undefined ? params.slopeBias : 0.004;
    this._cascadeCount = clampCascadeCount(params.cascadeCount !== undefined ? params.cascadeCount : 4);
    this._cascadeSplitLambda = clampCascadeSplitLambda(params.cascadeSplitLambda !== undefined ? params.cascadeSplitLambda : 0.5);
  }

  /**
   * Sets which rendering modes in which to apply shadows.
   *
   * Default `[`{@link constants!RealisticRender | RealisticRender}`]`
   * — shadows fire only in the realistic preset, since they are the
   * most expensive lighting term and rarely wanted during navigation
   * or detailed inspection.
   */
  set renderModes(value: number[]) {
    this._renderModes = value ? value.slice() : [];
    this.view.needsRender();
  }

  /**
   * Gets which rendering modes in which to apply shadows.
   */
  get renderModes(): number[] {
    return this._renderModes;
  }

  /**
   * Whether shadows are supported by this browser and GPU.
   */
  get supported(): boolean {
    return true;
  }

  /**
   * Returns true if shadows are currently possible — supported, enabled,
   * and the current view state is compatible.
   * @private
   */
  get possible(): boolean {
    if (!this.supported) return false;
    const projectionType = this.view.camera.projectionType;
    if (projectionType === CustomProjectionType) return false;
    if (projectionType === FrustumProjectionType) return false;
    return true;
  }

  /**
   * Gets whether shadows are currently applied.
   *
   * This is `true` when {@link View.renderMode | View.renderMode} is
   * in {@link Shadows.renderModes | Shadows.renderModes}.
   */
  get applied(): boolean {
    const mode = this.view.renderMode;
    for (let i = 0, len = this._renderModes.length; i < len; i++) {
      if (mode === this._renderModes[i]) return true;
    }
    return false;
  }

  /**
   * How dark a fully-occluded fragment becomes. Range [0..1]. Default `0.45`.
   */
  get intensity(): number {
    return this._intensity;
  }

  set intensity(value: number) {
    if (value === undefined || value === null) value = 0.45;
    if (this._intensity === value) return;
    this._intensity = value;
    this.view.needsRender();
  }

  /**
   * Depth-compare bias used to avoid shadow acne. Default `0.003`.
   */
  get bias(): number {
    return this._bias;
  }

  set bias(value: number) {
    if (value === undefined || value === null) value = 0.003;
    if (this._bias === value) return;
    this._bias = value;
    this.view.needsRender();
  }

  /**
   * Half-size (world units) of the shadow map's orthographic projection. Default `30`.
   */
  get projectionSize(): number {
    return this._projectionSize;
  }

  set projectionSize(value: number) {
    if (value === undefined || value === null) value = 30;
    if (this._projectionSize === value) return;
    this._projectionSize = value;
    this.view.needsRender();
  }

  /**
   * Distance from scene center at which the virtual light is placed along {@link direction}. Default `50`.
   */
  get lightDistance(): number {
    return this._lightDistance;
  }

  set lightDistance(value: number) {
    if (value === undefined || value === null) value = 50;
    if (this._lightDistance === value) return;
    this._lightDistance = value;
    this.view.needsRender();
  }

  /**
   * Pixel resolution of the square shadow map. Default `2048`.
   *
   * Changing this causes the shadow-map FBO to be reallocated on the next frame.
   */
  get resolution(): number {
    return this._resolution;
  }

  set resolution(value: number) {
    if (value === undefined || value === null) value = 2048;
    value = Math.max(64, Math.floor(value));
    if (this._resolution === value) return;
    this._resolution = value;
    this.view.needsRender();
  }

  /**
   * Direction the shadow-casting light points in. Stored normalized. Default `[-0.5,-1,-0.3]`.
   */
  get direction(): Float32Array<any> {
    return this._direction;
  }

  set direction(value: FloatArrayParam) {
    if (!value) return;
    this._direction.set(value as ArrayLike<number>);
    normalizeInPlace(this._direction);
    this.view.needsRender();
  }

  /**
   * Whether the shadow frustum is auto-fitted to the camera view each frame.
   * Default `true`.
   */
  get autoFit(): boolean {
    return this._autoFit;
  }

  set autoFit(value: boolean) {
    value = value !== false;
    if (this._autoFit === value) return;
    this._autoFit = value;
    this.view.needsRender();
  }

  /**
   * When {@link autoFit} is true, the shadow far-plane distance from the camera
   * is clamped to this value. Default `200`.
   */
  get maxDistance(): number {
    return this._maxDistance;
  }

  set maxDistance(value: number) {
    if (value === undefined || value === null) value = 200;
    if (this._maxDistance === value) return;
    this._maxDistance = value;
    this.view.needsRender();
  }

  /**
   * Padding multiplier for the auto-fitted shadow frustum. Default `1.1`.
   */
  get padding(): number {
    return this._padding;
  }

  set padding(value: number) {
    if (value === undefined || value === null) value = 1.1;
    if (this._padding === value) return;
    this._padding = value;
    this.view.needsRender();
  }

  /**
   * PCF kernel size in texels (odd integer, range [1, 7]). Default `3`.
   */
  get pcfKernelSize(): number {
    return this._pcfKernelSize;
  }

  set pcfKernelSize(value: number) {
    if (value === undefined || value === null) value = 3;
    value = clampPcfKernelSize(value);
    if (this._pcfKernelSize === value) return;
    this._pcfKernelSize = value;
    this.view.needsRender();
  }

  /**
   * View-space normal-offset bias applied when sampling the shadow map.
   * Default `0.02`.
   */
  get normalOffsetBias(): number {
    return this._normalOffsetBias;
  }

  set normalOffsetBias(value: number) {
    if (value === undefined || value === null) value = 0.02;
    if (this._normalOffsetBias === value) return;
    this._normalOffsetBias = value;
    this.view.needsRender();
  }

  /**
   * Slope-scaled depth bias. Default `0.004`.
   */
  get slopeBias(): number {
    return this._slopeBias;
  }

  set slopeBias(value: number) {
    if (value === undefined || value === null) value = 0.004;
    if (this._slopeBias === value) return;
    this._slopeBias = value;
    this.view.needsRender();
  }

  /**
   * Number of shadow cascades. Range `[1, 4]`. Default `1`.
   */
  get cascadeCount(): number {
    return this._cascadeCount;
  }

  set cascadeCount(value: number) {
    if (value === undefined || value === null) value = 1;
    value = clampCascadeCount(value);
    if (this._cascadeCount === value) return;
    this._cascadeCount = value;
    this.view.needsRender();
  }

  /**
   * Blend between uniform and logarithmic cascade splits. Range `[0, 1]`.
   * Default `0.5`.
   */
  get cascadeSplitLambda(): number {
    return this._cascadeSplitLambda;
  }

  set cascadeSplitLambda(value: number) {
    if (value === undefined || value === null) value = 0.5;
    value = clampCascadeSplitLambda(value);
    if (this._cascadeSplitLambda === value) return;
    this._cascadeSplitLambda = value;
    this.view.needsRender();
  }

  /**
   * Gets the current configuration of this Shadows component.
   */
  toParams(): SDKResult<ShadowsParams> {
    return {
      ok: true,
      value: {
        renderModes: this._renderModes.slice(),
        intensity: this._intensity,
        bias: this._bias,
        projectionSize: this._projectionSize,
        lightDistance: this._lightDistance,
        resolution: this._resolution,
        direction: Array.from(this._direction),
        autoFit: this._autoFit,
        maxDistance: this._maxDistance,
        padding: this._padding,
        pcfKernelSize: this._pcfKernelSize,
        normalOffsetBias: this._normalOffsetBias,
        slopeBias: this._slopeBias,
        cascadeCount: this._cascadeCount,
        cascadeSplitLambda: this._cascadeSplitLambda
      }
    };
  }

  /**
   * Configures this Shadows component.
   */
  fromParams(params: ShadowsParams): SDKResult<any> {
    if (this._destroyed) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[Shadows.fromParams] Shadows has been destroyed."
      });
    }
    if (params.renderModes !== undefined) this.renderModes = params.renderModes;
    if (params.intensity !== undefined) this.intensity = params.intensity;
    if (params.bias !== undefined) this.bias = params.bias;
    if (params.projectionSize !== undefined) this.projectionSize = params.projectionSize;
    if (params.lightDistance !== undefined) this.lightDistance = params.lightDistance;
    if (params.resolution !== undefined) this.resolution = params.resolution;
    if (params.direction !== undefined) this.direction = params.direction;
    if (params.autoFit !== undefined) this.autoFit = params.autoFit;
    if (params.maxDistance !== undefined) this.maxDistance = params.maxDistance;
    if (params.padding !== undefined) this.padding = params.padding;
    if (params.pcfKernelSize !== undefined) this.pcfKernelSize = params.pcfKernelSize;
    if (params.normalOffsetBias !== undefined) this.normalOffsetBias = params.normalOffsetBias;
    if (params.slopeBias !== undefined) this.slopeBias = params.slopeBias;
    if (params.cascadeCount !== undefined) this.cascadeCount = params.cascadeCount;
    if (params.cascadeSplitLambda !== undefined) this.cascadeSplitLambda = params.cascadeSplitLambda;
    return { ok: true, value: undefined };
  }

  /** @private */
  destroy() {
    this._destroyed = true;
  }
}

function clampCascadeCount(value: number): number {
  let v = Math.round(value);
  if (!Number.isFinite(v) || v < 1) v = 1;
  if (v > 6) v = 6;
  return v;
}

function clampCascadeSplitLambda(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function clampPcfKernelSize(value: number): number {
  // Snap to the nearest odd integer in [1, 7].
  let v = Math.round(value);
  if (v < 1) v = 1;
  if (v > 7) v = 7;
  if ((v & 1) === 0) v += 1;
  return v;
}

function normalizeInPlace(v: Float32Array<any>): void {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len < 1e-8) {
    v[0] = 0;
    v[1] = -1;
    v[2] = 0;
    return;
  }
  v[0] /= len;
  v[1] /= len;
  v[2] /= len;
}
