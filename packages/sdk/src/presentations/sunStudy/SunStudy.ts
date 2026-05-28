import type {SunStudyParams} from "./SunStudyParams";
import type {SunPosition} from "./SunPosition";
import {computeSunPosition, sunDirection} from "./SunPosition";
import {DirLight} from "../../viewing/viewer/DirLight";
import type {View} from "../../viewing/viewer";
import {EventEmitter} from "../../base/core";
import {EventDispatcher} from "strongly-typed-events";


const DEFAULT_SUN_COLOR:  [number, number, number] = [1.0, 0.96, 0.86];
const HORIZON_WARM_COLOR: [number, number, number] = [1.0, 0.55, 0.25];  // golden-hour tint
const NIGHT_COLOR:        [number, number, number] = [0.04, 0.07, 0.14]; // moonless dim residual


/**
 * Daylight / sun-study controller for a {@link viewing!viewer.View | View}.
 *
 * Owns:
 *   - A geo-location ({@link latitude}, {@link longitude}) and the
 *     scene's {@link northAngleDegrees | north rotation}.
 *   - A wall-clock cursor ({@link currentDate}).
 *   - A single {@link viewing!viewer.DirLight | DirLight} that
 *     represents the sun, with `dir` / `color` / `intensity` driven
 *     from the cursor.
 *
 * On every state change the SunStudy recomputes the sun position via
 * the NOAA solar-position algorithm in {@link SunPosition.computeSunPosition},
 * converts altitude / azimuth into a world-space direction-of-light
 * vector, and writes the result to its DirLight. Output is also
 * exposed through {@link sunPosition} so other systems (analysis
 * passes, shaders, sky shaders, time-of-day UI readouts) can subscribe.
 *
 * ## What it's for
 *
 * - **Shadow / daylight studies.** Place a model at its real site
 *   coordinates, scrub a date / time, watch shadows fall the way
 *   they actually would. Couples cleanly with the shadow pipeline.
 * - **Code-compliance analyses** (LEED EQ Credit 8.1 daylight
 *   factor, BREEAM Hea 01, EN 17037 daylight provision). Compute the
 *   sun position at every hour across the year; sample illumination
 *   at each interior surface; surface as a `presentations/heatmaps`
 *   gradient.
 * - **Client presentation / marketing.** Animate a day-in-the-life
 *   sequence with the {@link AnnualSunPlayer} — sunrise warms the
 *   east facade, midday casts hard shadows, sunset lights the
 *   atrium glazing.
 *
 * ## How it talks to the rest of the SDK
 *
 * - The sun is **a DirLight** registered through `View.registerLight`,
 *   same as any application-supplied directional light. Existing
 *   shadow / PBR pipelines pick it up with no extra wiring.
 * - The {@link onDateChanged} event fires after every cursor change,
 *   so a heatmap-analysis runner, a sky shader, or a date-readout UI
 *   stay in lockstep.
 *
 * @module presentations/sunStudy
 */
export class SunStudy {

  /**
   * Most recently constructed (and not yet destroyed) SunStudy.
   * Used by the Toolbar's "Sun Study" button to open the panel
   * even when the app hasn't pre-mounted it — the button picks
   * up whichever SunStudy the app most recently created.
   */
  private static _latest: SunStudy | null = null;

  /**
   * Returns the most recently constructed SunStudy that hasn't
   * been destroyed, or `undefined` when none exists. The
   * {@link SunStudyPanel}'s registry `create` provider falls back
   * to this when its params don't carry a `sunStudy` (the
   * Toolbar button path).
   */
  static getLatest(): SunStudy | undefined {
    const inst = SunStudy._latest;
    return inst && !inst._destroyed ? inst : undefined;
  }

  public readonly view: View;

  /** The DirLight the sun-study drives. Public so callers can read
   *  the current dir / colour / intensity for shaders that need them. */
  public readonly sunLight: DirLight;

  /** Fires after every cursor / location / north-angle change. The
   *  payload is the freshly-computed sun position. */
  public readonly onChanged: EventEmitter<SunStudy, SunPosition>;

  private _latitude: number;
  private _longitude: number;
  private _northAngleDegrees: number;
  private _currentMs: number;
  private _sunColor:     [number, number, number];
  private _sunIntensity: number;
  private _goldenHourBlend: boolean;
  private _driveShadows:    boolean;
  private _driveSky:        boolean;
  private _driveSkyPalette: boolean;
  private _driveExposure:   boolean;
  private _nightExposureFactor: number;
  private _baseShadowIntensity: number;
  private _baseExposure: number | null = null;
  // Day palette snapshot — captured from view.effects.sky on first
  // _apply() so the twilight lerp anchors to whatever palette the
  // caller had already configured. Null until first apply or when
  // view.effects.sky is unavailable.
  private _baseSkyColor:      [number, number, number] | null = null;
  private _baseHorizonColor:  [number, number, number] | null = null;
  private _baseGroundColor:   [number, number, number] | null = null;
  private _nightSkyColor:     [number, number, number];
  private _nightHorizonColor: [number, number, number];
  private _nightGroundColor:  [number, number, number];
  private _sunPosition: SunPosition;
  private _destroyed: boolean = false;
  private _scratchDir: Float32Array = new Float32Array(3);

  constructor(params: SunStudyParams) {

    if (!params || !params.view) {
      throw new Error("[SunStudy] params.view is required");
    }
    this.view = params.view;
    this._latitude          = params.latitude  ?? 0;
    this._longitude         = params.longitude ?? 0;
    this._northAngleDegrees = params.northAngleDegrees ?? 0;
    this._sunColor          = params.sunColor       ?? DEFAULT_SUN_COLOR;
    this._sunIntensity      = params.sunIntensity   ?? 1.0;
    this._goldenHourBlend   = params.goldenHourBlend !== false;
    this._driveShadows      = params.driveShadows    !== false;
    this._driveSky          = params.driveSky        !== false;
    this._driveSkyPalette   = params.driveSkyPalette !== false;
    this._driveExposure     = params.driveExposure   !== false;
    this._nightExposureFactor = clamp01(params.nightExposureFactor ?? 0.15);
    this._nightSkyColor     = params.nightSkyColor     ?? [0.02, 0.03, 0.08];
    this._nightHorizonColor = params.nightHorizonColor ?? [0.04, 0.05, 0.10];
    this._nightGroundColor  = params.nightGroundColor  ?? [0.01, 0.01, 0.02];
    // Snapshot the View's current shadow intensity as the "peak"
    // — the per-frame intensity scales by sin(altitude) off this.
    this._baseShadowIntensity = (this.view as any).effects?.shadows?.intensity ?? 0.45;

    const initialDate = params.currentDate !== undefined
      ? (params.currentDate instanceof Date
          ? params.currentDate
          : new Date(params.currentDate))
      : defaultStartDate();
    this._currentMs = initialDate.getTime();

    // Construct a fresh DirLight on the view in world space so the
    // sun stays anchored as the camera moves. The DirLight constructor
    // self-registers via `view.registerLight`, so the existing
    // shadow / PBR pipelines find it without any extra wiring.
    this.sunLight = new DirLight(this.view, {
      dir:       [0, 0, -1],            // overwritten by first apply
      color:     [...this._sunColor],
      intensity: this._sunIntensity,
      space:     "world",
    });

    this.onChanged = new EventEmitter(new EventDispatcher<SunStudy, SunPosition>());

    this._sunPosition = { altitude: 0, azimuth: 0, aboveHorizon: false };
    SunStudy._latest = this;
    this._apply();
  }

  // ── Geo location ────────────────────────────────────────────────

  public get latitude(): number  { return this._latitude;  }
  public get longitude(): number { return this._longitude; }
  public get northAngleDegrees(): number { return this._northAngleDegrees; }

  public set latitude(v: number) {
    if (v === this._latitude || this._destroyed) return;
    this._latitude = v;
    this._apply();
  }

  public set longitude(v: number) {
    if (v === this._longitude || this._destroyed) return;
    this._longitude = v;
    this._apply();
  }

  public set northAngleDegrees(v: number) {
    if (v === this._northAngleDegrees || this._destroyed) return;
    this._northAngleDegrees = v;
    this._apply();
  }

  /**
   * Convenience setter for `(latitude, longitude)` in one call —
   * triggers a single recompute / dispatch rather than two when both
   * coordinates change together (e.g. picking a city from a dropdown).
   */
  public setLocation(latitude: number, longitude: number): void {
    if (this._destroyed) return;
    if (latitude === this._latitude && longitude === this._longitude) return;
    this._latitude = latitude;
    this._longitude = longitude;
    this._apply();
  }

  // ── Time cursor ─────────────────────────────────────────────────

  public get currentDate(): Date     { return new Date(this._currentMs); }
  public get currentDateMs(): number { return this._currentMs; }

  public set currentDate(d: Date | string) {
    const ms = (d instanceof Date) ? d.getTime() : new Date(d).getTime();
    this.setDateMs(ms);
  }

  public setDateMs(ms: number): void {
    if (this._destroyed || !Number.isFinite(ms) || ms === this._currentMs) return;
    this._currentMs = ms;
    this._apply();
  }

  // ── Computed read-back ──────────────────────────────────────────

  /** Most recent sun position (altitude / azimuth / aboveHorizon).
   *  Returns the same object the {@link onChanged} event dispatched,
   *  so a subscriber can also read from this getter on demand
   *  (e.g. building a one-shot analysis run). */
  public get sunPosition(): SunPosition { return this._sunPosition; }

  /**
   * Multiplier applied to the captured day {@link Tonemap.exposure}
   * at the deep-night end of the twilight lerp (sun altitude ≤ -6°).
   * Range `[0, 1]` — `0` is black, `1` disables darkening.
   *
   * Setting this triggers an immediate `_apply()` so the visible
   * exposure tracks the new factor on the next frame, without
   * waiting for a cursor change.
   */
  public get nightExposureFactor(): number { return this._nightExposureFactor; }
  public set nightExposureFactor(v: number) {
    if (this._destroyed) return;
    v = clamp01(v);
    if (v === this._nightExposureFactor) return;
    this._nightExposureFactor = v;
    this._apply();
  }

  public get destroyed(): boolean { return this._destroyed; }

  // ── Lifecycle ───────────────────────────────────────────────────

  public destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    if (SunStudy._latest === this) SunStudy._latest = null;
    // DirLight has no exposed destroy method — `deregisterLight`
    // does the work on the View side. The light's per-View entries
    // get cleaned up when the View itself is destroyed; for our
    // purposes leaving the now-static light in place is harmless
    // and lets late subscribers still see the final sun direction.
    this.onChanged.clear();
  }

  // ── Internals ───────────────────────────────────────────────────

  /**
   * Recompute sun position and write to the DirLight. Allocation-free
   * after the constructor's first call — reuses `_scratchDir` and
   * mutates `_sunPosition` in place.
   */
  private _apply(): void {
    const date = new Date(this._currentMs);
    this._sunPosition = computeSunPosition(
      date, this._latitude, this._longitude);

    const northR = this._northAngleDegrees * Math.PI / 180;
    sunDirection(this._sunPosition, northR, this._scratchDir);
    this.sunLight.dir = this._scratchDir;

    // Shadow-pipeline integration. The View's shadow effect has its
    // own `direction` field, independent from the DirLight — the
    // shadow-map camera reads it directly. Mirror our sun direction
    // there so cast shadows track the actual sun position.
    const shadows = (this.view as any).effects?.shadows;
    if (shadows && this._driveShadows) {
      shadows.direction = this._scratchDir;
    }

    // Sky-pipeline integration. `sky.sunDirection` points TOWARD
    // the sun (opposite sign of the light's photon-travel dir), so
    // negate. The visible sun disc + glow track the same horizon
    // arc the DirLight does.
    const sky = (this.view as any).effects?.sky;
    if (sky && this._driveSky) {
      sky.sunDirection = [
        -this._scratchDir[0],
        -this._scratchDir[1],
        -this._scratchDir[2],
      ];
    }

    // Snapshot the View's current sky palette on first apply — same
    // pattern as `_baseShadowIntensity` above. Captured "day" palette
    // is the lerp anchor for the twilight darkening pass below, so
    // whatever the caller configured stays as the noon look.
    if (sky && this._driveSkyPalette && this._baseSkyColor === null) {
      this._baseSkyColor     = [sky.skyColor[0],     sky.skyColor[1],     sky.skyColor[2]];
      this._baseHorizonColor = [sky.horizonColor[0], sky.horizonColor[1], sky.horizonColor[2]];
      this._baseGroundColor  = [sky.groundColor[0],  sky.groundColor[1],  sky.groundColor[2]];
    }

    // Sky palette twilight lerp — runs every apply so the palette
    // is correct in both directions (scrubbing back to noon
    // restores the day palette). Civil-twilight threshold convention:
    // alt ≥ +5° → full day palette; alt ≤ -6° → full night palette;
    // smooth lerp in between.
    if (sky && this._driveSkyPalette && this._baseSkyColor) {
      const alt = this._sunPosition.altitude;
      const t   = Math.max(0, Math.min(1, (alt - (-6)) / (5 - (-6))));
      const day = (i: 0 | 1 | 2, base: [number, number, number], night: [number, number, number]) =>
        base[i] * t + night[i] * (1 - t);
      sky.skyColor     = [day(0, this._baseSkyColor!,     this._nightSkyColor),
                          day(1, this._baseSkyColor!,     this._nightSkyColor),
                          day(2, this._baseSkyColor!,     this._nightSkyColor)];
      sky.horizonColor = [day(0, this._baseHorizonColor!, this._nightHorizonColor),
                          day(1, this._baseHorizonColor!, this._nightHorizonColor),
                          day(2, this._baseHorizonColor!, this._nightHorizonColor)];
      sky.groundColor  = [day(0, this._baseGroundColor!,  this._nightGroundColor),
                          day(1, this._baseGroundColor!,  this._nightGroundColor),
                          day(2, this._baseGroundColor!,  this._nightGroundColor)];
    }

    // Tonemap exposure twilight lerp — the "darken everything"
    // lever. Multiplier hits the HDR framebuffer before the tone
    // curve, so PBR, flat-shaded, sky, infinite grid all attenuate
    // uniformly. Captures the caller's day exposure on first
    // apply, lerps toward `dayExposure × nightExposureFactor`
    // across the same +5° → -6° band as the palette.
    const tonemap = (this.view as any).effects?.tonemap;
    if (tonemap && this._driveExposure) {
      if (this._baseExposure === null) {
        this._baseExposure = tonemap.exposure;
      }
      const alt = this._sunPosition.altitude;
      const t   = Math.max(0, Math.min(1, (alt - (-6)) / (5 - (-6))));
      const night = this._baseExposure * this._nightExposureFactor;
      tonemap.exposure = this._baseExposure * t + night * (1 - t);
    }

    // Intensity & colour modulation.
    //   - Below horizon: night residual.
    //   - Just-above horizon: golden-hour warm, low intensity.
    //   - Mid sky: blended ratio.
    //   - High noon: nominal colour, full intensity.
    const alt = this._sunPosition.altitude;
    if (alt <= 0) {
      this.sunLight.color     = NIGHT_COLOR as any;
      this.sunLight.intensity = 0.06;
      // No sun → no shadows. Setting intensity to zero (rather than
      // pulling the effect out of `renderModes`) leaves the pass
      // running but produces no occlusion contribution, which is
      // cheaper than re-classifying the bin every frame around
      // sunrise / sunset.
      if (shadows && this._driveShadows) shadows.intensity = 0;
      // No sun → hide the disc + glow but keep the sky/horizon
      // gradient drawing (a dim residual reads as "twilight" on
      // the procedural sky, which is close enough for screening).
      if (sky && this._driveSky) sky.sunEnabled = false;
      this.onChanged.dispatch(this, this._sunPosition);
      return;
    }
    if (sky && this._driveSky) sky.sunEnabled = true;

    // sin(altitude) ∈ (0, 1] across the day-sky range.
    const sinAlt = Math.sin(alt * Math.PI / 180);

    let r: number, g: number, b: number;
    if (this._goldenHourBlend) {
      // Blend between warm horizon and neutral noon. Power-curved so
      // the warmth is dramatic in the first 15° of altitude and
      // settles to the nominal colour by ~30°.
      const blend = Math.max(0, Math.min(1, sinAlt ** 0.35));
      r = this._sunColor[0] * blend + HORIZON_WARM_COLOR[0] * (1 - blend);
      g = this._sunColor[1] * blend + HORIZON_WARM_COLOR[1] * (1 - blend);
      b = this._sunColor[2] * blend + HORIZON_WARM_COLOR[2] * (1 - blend);
    } else {
      r = this._sunColor[0];
      g = this._sunColor[1];
      b = this._sunColor[2];
    }
    this.sunLight.color = [r, g, b] as any;
    this.sunLight.intensity = this._sunIntensity * sinAlt;

    // Same colour curve drives the visible sun disc + corona so the
    // procedural sky shows golden tones at sunrise / sunset and a
    // neutral high-noon disc — visually consistent with the lit
    // surfaces in the scene.
    if (sky && this._driveSky) {
      sky.sunColor = [r, g, b];
    }

    // Shadow density follows the same `sin(altitude)` curve so the
    // hard noon shadows soften gradually toward sunset. Anchored to
    // the View's pre-SunStudy `shadows.intensity` so the caller's
    // own peak value is respected.
    if (shadows && this._driveShadows) {
      shadows.intensity = this._baseShadowIntensity * sinAlt;
    }

    this.onChanged.dispatch(this, this._sunPosition);
  }
}


/**
 * Summer-solstice noon UTC of the current year — the default
 * starting cursor. Lands the sun high and central so a first-load
 * view shows the model with strong cast shadows rather than the
 * murky pre-dawn / post-sunset states.
 */
function defaultStartDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), 5, 21, 12, 0, 0));
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
