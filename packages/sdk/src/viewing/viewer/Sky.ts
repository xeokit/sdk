import type {SkyParams} from "./SkyParams";
import type {View} from "./View";
import type {FloatArrayParam} from "../../base/math";


const DEFAULT_SUN_DIRECTION: [number, number, number] = [0.577, 0.577, 0.577];


/**
 * Procedural-sky background controls for a {@link View}.
 *
 * Located at {@link Effects.sky}, which lives at {@link View.effects}.
 * The underlying {@link SkyRenderer} reads these fields each frame,
 * so any setter takes effect on the next draw — that's what lets
 * {@link presentations!sunStudy.SunStudy | SunStudy} animate the
 * sky disc in sync with its time cursor (see SunStudy's
 * `driveSky` option).
 *
 * Although there's a single physical SkyRenderer shared across all
 * Views in a Viewer, each View carries its own `effects.sky`
 * configuration and the renderer pulls from the View it's currently
 * drawing — so multi-View layouts can give every View a different
 * sun.
 *
 * @module viewing/viewer
 */
export class Sky {

  public readonly view: View;

  private _enabled:           boolean;
  private _skyColor:          [number, number, number];
  private _horizonColor:      [number, number, number];
  private _groundColor:       [number, number, number];
  private _horizonBlend:      number;
  private _sunEnabled:        boolean;
  private _sunDirection:      [number, number, number];
  private _sunColor:          [number, number, number];
  private _sunAngularSize:    number;
  private _sunGlowSize:       number;
  private _sunGlowIntensity:  number;
  private _worldUp:           [number, number, number];
  private _destroyed = false;

  /** @private */
  constructor(view: View, params: SkyParams) {
    this.view = view;
    this._enabled          = params.enabled          ?? true;
    this._skyColor         = copy3(params.skyColor,         [0.74, 0.80, 0.88]);
    this._horizonColor     = copy3(params.horizonColor,     [0.66, 0.72, 0.74]);
    this._groundColor      = copy3(params.groundColor,      [0.58, 0.64, 0.60]);
    this._horizonBlend     = params.horizonBlend     ?? 0.5;
    this._sunEnabled       = params.sunEnabled       ?? true;
    this._sunDirection     = copy3(params.sunDirection,     DEFAULT_SUN_DIRECTION);
    this._sunColor         = copy3(params.sunColor,         [1.0, 0.97, 0.82]);
    this._sunAngularSize   = params.sunAngularSize   ?? 3.0;
    this._sunGlowSize      = params.sunGlowSize      ?? 16.0;
    this._sunGlowIntensity = params.sunGlowIntensity ?? 0.25;
    this._worldUp          = copy3(params.worldUp,          [0, 0, 1]);
  }

  /** Draw the procedural sky background at all. Default `true`. */
  get enabled(): boolean { return this._enabled; }
  set enabled(v: boolean) {
    v = v !== false;
    if (this._enabled === v) return;
    this._enabled = v;
    this.view.needsRender();
  }

  get skyColor(): [number, number, number] { return this._skyColor; }
  set skyColor(v: FloatArrayParam) { writeColor(this._skyColor, v); this.view.needsRender(); }

  get horizonColor(): [number, number, number] { return this._horizonColor; }
  set horizonColor(v: FloatArrayParam) { writeColor(this._horizonColor, v); this.view.needsRender(); }

  get groundColor(): [number, number, number] { return this._groundColor; }
  set groundColor(v: FloatArrayParam) { writeColor(this._groundColor, v); this.view.needsRender(); }

  get horizonBlend(): number { return this._horizonBlend; }
  set horizonBlend(v: number) {
    if (!Number.isFinite(v) || v === this._horizonBlend) return;
    this._horizonBlend = v;
    this.view.needsRender();
  }

  /** Whether to draw the sun disc + glow. Default `true`. */
  get sunEnabled(): boolean { return this._sunEnabled; }
  set sunEnabled(v: boolean) {
    v = v !== false;
    if (this._sunEnabled === v) return;
    this._sunEnabled = v;
    this.view.needsRender();
  }

  /**
   * World-space direction **toward** the sun (need not be normalized
   * — the renderer normalizes per frame). To sync with a
   * {@link DirLight}, negate the light's `dir` (the light's `dir`
   * is the way photons travel, the opposite sign).
   */
  get sunDirection(): [number, number, number] { return this._sunDirection; }
  set sunDirection(v: FloatArrayParam) { writeColor(this._sunDirection, v); this.view.needsRender(); }

  get sunColor(): [number, number, number] { return this._sunColor; }
  set sunColor(v: FloatArrayParam) { writeColor(this._sunColor, v); this.view.needsRender(); }

  get sunAngularSize(): number { return this._sunAngularSize; }
  set sunAngularSize(v: number) {
    if (!Number.isFinite(v) || v === this._sunAngularSize) return;
    this._sunAngularSize = v;
    this.view.needsRender();
  }

  get sunGlowSize(): number { return this._sunGlowSize; }
  set sunGlowSize(v: number) {
    if (!Number.isFinite(v) || v === this._sunGlowSize) return;
    this._sunGlowSize = v;
    this.view.needsRender();
  }

  get sunGlowIntensity(): number { return this._sunGlowIntensity; }
  set sunGlowIntensity(v: number) {
    if (!Number.isFinite(v) || v === this._sunGlowIntensity) return;
    this._sunGlowIntensity = v;
    this.view.needsRender();
  }

  get worldUp(): [number, number, number] { return this._worldUp; }
  set worldUp(v: FloatArrayParam) { writeColor(this._worldUp, v); this.view.needsRender(); }

  /** @private */
  destroy(): void {
    this._destroyed = true;
  }
}


function copy3(
  src: ArrayLike<number> | undefined,
  fallback: [number, number, number],
): [number, number, number] {
  return src
    ? [src[0], src[1], src[2]]
    : [fallback[0], fallback[1], fallback[2]];
}

function writeColor(dst: [number, number, number], src: FloatArrayParam): void {
  if (!src) return;
  dst[0] = src[0];
  dst[1] = src[1];
  dst[2] = src[2];
}
