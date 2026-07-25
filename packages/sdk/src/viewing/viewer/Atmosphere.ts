import type {AtmosphereParams} from "./AtmosphereParams";
import type {View} from "./View";
import type {FloatArrayParam} from "../../base/math";
import {SDKErrorType, type SDKResult} from "../../base/core";
import {RealisticRender} from "../../base/constants";

/**
 * Configures distance-based atmospheric attenuation for a
 * {@link viewing!viewer.View | View}.
 *
 * * Located at {@link Effects.atmosphere}, which lives at {@link View.effects}.
 * * Runs as an HDR post-process before depth of field and tonemap.
 * * Uses scene depth to fade distant geometry toward a configurable haze color.
 */
export class Atmosphere {

  /** The View this Atmosphere belongs to. */
  public readonly view: View;

  private _renderModes: number[];
  private _color: [number, number, number];
  private _startDistance: number;
  private _endDistance: number;
  private _intensity: number;
  private _maxOpacity: number;
  private _affectSky: boolean;
  private _destroyed = false;

  /** @private */
  constructor(view: View, params: AtmosphereParams) {
    this.view = view;
    this._renderModes = params.renderModes ?? [RealisticRender];
    this._color = copyColor(params.color, [0.72, 0.82, 0.92]);
    this._startDistance = clampNonNegative(params.startDistance, 80);
    this._endDistance = clampMin(params.endDistance, this._startDistance + 1, 500);
    this._intensity = clampRange(params.intensity, 0, 1, 0.35);
    this._maxOpacity = clampRange(params.maxOpacity, 0, 1, 0.55);
    this._affectSky = params.affectSky === true;
  }

  /**
   * Sets which rendering modes in which to apply atmospheric attenuation.
   *
   * Default value is [{@link base!constants.RealisticRender | RealisticRender}]
   * when this effect is explicitly configured.
   */
  set renderModes(value: number[]) {
    this._renderModes = value || [];
    this.view.needsRender();
  }

  /** Gets which rendering modes in which to apply atmospheric attenuation. */
  get renderModes(): number[] {
    return this._renderModes;
  }

  /**
   * Returns true if atmospheric attenuation is currently possible given the
   * View's state. The renderer is the authority on whether the GPU can run it.
   * @private
   */
  get possible(): boolean {
    return true;
  }

  /**
   * Gets if atmospheric attenuation is currently applied.
   *
   * This is `true` when {@link View.renderMode | View.renderMode} is
   * in {@link Atmosphere.renderModes | Atmosphere.renderModes}.
   */
  get applied(): boolean {
    for (let i = 0, len = this._renderModes.length; i < len; i++) {
      if (this.view.renderMode === this._renderModes[i]) {
        return true;
      }
    }
    return false;
  }

  /** RGB haze color mixed into distant scene geometry. */
  get color(): [number, number, number] {
    return this._color;
  }

  set color(value: FloatArrayParam) {
    writeColor(this._color, value);
    this.view.needsRender();
  }

  /** View-space distance, in world units, at which attenuation begins. */
  get startDistance(): number {
    return this._startDistance;
  }

  set startDistance(value: number) {
    value = clampNonNegative(value, 80);
    if (this._startDistance === value) return;
    this._startDistance = value;
    if (this._endDistance <= this._startDistance) {
      this._endDistance = this._startDistance + 1;
    }
    this.view.needsRender();
  }

  /** View-space distance, in world units, at which attenuation reaches full strength. */
  get endDistance(): number {
    return this._endDistance;
  }

  set endDistance(value: number) {
    value = clampMin(value, this._startDistance + 1, 500);
    if (this._endDistance === value) return;
    this._endDistance = value;
    this.view.needsRender();
  }

  /** Overall atmospheric attenuation strength. Default `0.35`. */
  get intensity(): number {
    return this._intensity;
  }

  set intensity(value: number) {
    value = clampRange(value, 0, 1, 0.35);
    if (this._intensity === value) return;
    this._intensity = value;
    this.view.needsRender();
  }

  /** Maximum haze opacity after distance and intensity are applied. Default `0.55`. */
  get maxOpacity(): number {
    return this._maxOpacity;
  }

  set maxOpacity(value: number) {
    value = clampRange(value, 0, 1, 0.55);
    if (this._maxOpacity === value) return;
    this._maxOpacity = value;
    this.view.needsRender();
  }

  /** Whether to haze sky/background pixels. Default `false`. */
  get affectSky(): boolean {
    return this._affectSky;
  }

  set affectSky(value: boolean) {
    value = value === true;
    if (this._affectSky === value) return;
    this._affectSky = value;
    this.view.needsRender();
  }

  /** Gets this Atmosphere as JSON. */
  toParams(): SDKResult<AtmosphereParams> {
    return {
      ok: true,
      value: {
        renderModes: this._renderModes,
        color: [this._color[0], this._color[1], this._color[2]],
        startDistance: this._startDistance,
        endDistance: this._endDistance,
        intensity: this._intensity,
        maxOpacity: this._maxOpacity,
        affectSky: this._affectSky
      }
    };
  }

  /** Configures this Atmosphere. */
  fromParams(params: AtmosphereParams): SDKResult<any> {
    if (this._destroyed) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[Atmosphere.fromParams] Atmosphere has been destroyed."
      });
    }
    if (params.renderModes !== undefined) this.renderModes = params.renderModes;
    if (params.color !== undefined) this.color = params.color;
    if (params.startDistance !== undefined) this.startDistance = params.startDistance;
    if (params.endDistance !== undefined) this.endDistance = params.endDistance;
    if (params.intensity !== undefined) this.intensity = params.intensity;
    if (params.maxOpacity !== undefined) this.maxOpacity = params.maxOpacity;
    if (params.affectSky !== undefined) this.affectSky = params.affectSky;
    return {ok: true, value: undefined};
  }

  /** @private */
  destroy() {
    this._destroyed = true;
  }
}

function copyColor(src: ArrayLike<number> | undefined, fallback: [number, number, number]): [number, number, number] {
  return src
    ? [clampRange(src[0], 0, 1, fallback[0]), clampRange(src[1], 0, 1, fallback[1]), clampRange(src[2], 0, 1, fallback[2])]
    : [fallback[0], fallback[1], fallback[2]];
}

function writeColor(dst: [number, number, number], src: FloatArrayParam): void {
  if (!src) return;
  dst[0] = clampRange(src[0], 0, 1, dst[0]);
  dst[1] = clampRange(src[1], 0, 1, dst[1]);
  dst[2] = clampRange(src[2], 0, 1, dst[2]);
}

function clampNonNegative(value: number | undefined, fallback: number): number {
  if (value === undefined || value === null || !Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return value;
}

function clampMin(value: number | undefined, min: number, fallback: number): number {
  if (value === undefined || value === null || !Number.isFinite(value) || value < min) {
    return Math.max(fallback, min);
  }
  return value;
}

function clampRange(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return fallback;
  }
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
