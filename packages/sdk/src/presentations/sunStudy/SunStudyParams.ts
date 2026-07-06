import type {View} from "../../viewing/viewer";


/**
 * Parameters for {@link SunStudy | SunStudy}.
 *
 * @module presentations/sunStudy
 */
export interface SunStudyParams {

  /**
   * View the sun light gets attached to. The SunStudy constructs a
   * single `DirLight` on this view and re-aims / re-colours it on
   * every {@link SunStudy.currentDate} change.
   */
  view: View;

  /**
   * Site latitude in decimal degrees. North positive. Range `[-90, 90]`.
   * The sun's altitude and azimuth derive directly from this.
   */
  latitude: number;

  /**
   * Site longitude in decimal degrees. East positive. Range `[-180, 180]`.
   */
  longitude: number;

  /**
   * Initial moment for the sun cursor. JS `Date` (interpreted in UTC).
   * Defaults to summer-solstice noon UTC of the current year.
   */
  currentDate?: Date | string;

  /**
   * Clockwise rotation in **degrees** that the scene's `+Y` axis lies
   * away from true north. `0` means the model's `+Y` is north (the
   * convention for IFC's `IfcGeometricRepresentationContext.TrueNorth`
   * when the model was authored to grid north and TrueNorth was set to
   * identity).
   *
   * Models authored to a project grid that doesn't align with cardinal
   * north pass the project grid's rotation here so the sun's azimuth
   * lands correctly. Defaults to `0`.
   */
  northAngleDegrees?: number;

  /**
   * Override the daylight RGB colour. Default `[1.0, 0.96, 0.86]`.
   * The SunStudy automatically warms this toward orange at low sun
   * altitudes and dims it below the horizon (see {@link goldenHourBlend}).
   */
  sunColor?: [number, number, number];

  /**
   * Override the directional-light intensity at zenith. Default `1.0`.
   * The actual per-frame intensity scales by `sin(altitude)` (Lambert's
   * cosine law for surface insolation), so the noon intensity is
   * `sunIntensity` and the horizon intensity is `0`.
   */
  sunIntensity?: number;

  /**
   * When `true` (the default), the directional light's colour and
   * intensity blend toward warm orange at low sun altitudes (the
   * golden-hour effect: longer atmospheric path → more Rayleigh
   * scattering → warmer apparent colour). Set `false` for intensity-only
   * modulation.
   */
  goldenHourBlend?: boolean;

  /**
   * When `true` (the default), the SunStudy also drives the View's
   * shadow pipeline:
   *
   * - `view.effects.shadows.direction` is rewritten to match the
   *   sun's direction on every cursor change, so the shadow-map
   *   camera sees the scene from the same angle the sun does.
   * - The pre-existing `view.effects.shadows.intensity` configured
   *   at the time the SunStudy is constructed becomes the **peak**
   *   shadow density; the actual per-frame intensity scales by
   *   `sin(altitude)` so shadows soften toward the horizon and
   *   vanish below it.
   *
   * Set `false` to leave the shadow pipeline alone (e.g. if the app
   * has its own shadow direction logic, or wants a static
   * studio-light shadow that doesn't track the sun).
   */
  driveShadows?: boolean;

  /**
   * When `true` (the default), keeps the View's procedural-sky
   * background ({@link viewing!viewer.Sky | view.effects.sky}) in
   * lockstep with the sun. On every cursor change:
   *
   * - `sky.sunDirection` is rewritten to point toward the current sun
   *   (the visible sun disc + glow tracks the same horizon arc the
   *   DirLight does).
   * - `sky.sunColor` follows the golden-hour blend so the disc
   *   warms at sunrise / sunset, neutral at noon.
   * - `sky.sunEnabled` is toggled off when the sun is below the
   *   horizon — no spurious disc behind the camera at night.
   *
   * Set `false` to leave the sky pipeline alone (e.g. if the app
   * paints its own HDR sky cubemap, or wants a fixed studio
   * backdrop that doesn't change through the day).
   */
  driveSky?: boolean;

  /**
   * When `true` (the default), additionally lerps the sky's
   * `skyColor` / `horizonColor` / `groundColor` toward
   * {@link nightSkyColor} / {@link nightHorizonColor} /
   * {@link nightGroundColor} as the sun drops through civil
   * twilight (`+5°` → `-6°` solar altitude). The user's
   * "day palette" is captured on construction so the lerp
   * anchors to whatever colours the View was already configured with.
   *
   * Driving the palette dark also affects IBL: the IBL prefilter rebuilds
   * the indirect-light cubemap from the sky each frame.
   *
   * Set `false` if the app curates its own sky palette and only
   * wants the sun-direction / sun-colour parts of `driveSky`.
   */
  driveSkyPalette?: boolean;

  /**
   * Zenith colour the sky lerps to at deep night
   * (sun altitude ≤ -6°). Default `[0.02, 0.03, 0.08]`.
   */
  nightSkyColor?: [number, number, number];

  /**
   * Horizon colour the sky lerps to at deep night. Default
   * `[0.04, 0.05, 0.10]`.
   */
  nightHorizonColor?: [number, number, number];

  /**
   * Ground colour the sky lerps to at deep night. Default
   * `[0.01, 0.01, 0.02]`.
   */
  nightGroundColor?: [number, number, number];

  /**
   * When `true` (the default), additionally lerps the View's
   * `effects.tonemap.exposure` toward
   * `baseExposure × nightExposureFactor` across the same
   * civil-twilight band ({@link driveSkyPalette}). The caller's
   * configured exposure is captured on construction and used as
   * the day anchor.
   *
   * The multiplier is applied to the HDR framebuffer before tone mapping,
   * so it affects PBR, flat-shaded, sky, and grid pixels.
   *
   * Set `false` if the app drives exposure itself (e.g. an
   * eye-adaptation effect, or a fixed studio exposure).
   */
  driveExposure?: boolean;

  /**
   * Multiplier applied to the captured day exposure at the
   * deep-night end of the twilight lerp (sun altitude ≤ -6°).
   * Default `0.15`. Range `[0, 1]`:
   *
   *   - `0` → exposure goes to zero, scene goes black.
   *   - `0.15` → ~6× darker than noon.
   *   - `0.5` → mildly darker night; useful for compliance work
   *     where the user still needs to read material values.
   *   - `1` → no exposure change (effectively disables the
   *     darkening even with `driveExposure: true`).
   */
  nightExposureFactor?: number;
}
