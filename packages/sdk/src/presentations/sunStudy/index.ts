/**
 * # Sun Studies
 *
 * Daylight / shadow visualisation and analysis for AECO scenes.
 *
 * - {@link SunPosition.computeSunPosition} — pure-math NOAA Solar
 *   Position Algorithm: `(date, lat, lon) → { altitude, azimuth }`.
 * - {@link SunStudy} — owns the geo-location + time cursor + a
 *   `DirLight` representing the sun; auto-aims, auto-tints, and
 *   auto-dims the light as the cursor moves.
 * - {@link AnnualSunPlayer} — scrubs the cursor through a single
 *   day or a whole year on a configurable wall-clock pace.
 *
 * ## Usage
 *
 * ```ts
 * import * as xeokit from "@xeokit/sdk";
 *
 * const study = new xeokit.presentations.sunStudy.SunStudy({
 *   view,
 *   latitude:   49.28,
 *   longitude: -123.12,         // Vancouver
 *   northAngleDegrees: 0,
 *   currentDate: "2026-06-21T12:00:00Z",   // summer solstice noon UTC
 * });
 *
 * const player = new xeokit.presentations.sunStudy.AnnualSunPlayer({
 *   sunStudy: study,
 *   mode: "day",
 *   durationSeconds: 10,
 *   autoPlay: true,
 * });
 *
 * study.onChanged.subscribe((s, pos) => {
 *   readoutEl.textContent =
 *     `alt ${pos.altitude.toFixed(1)}° / az ${pos.azimuth.toFixed(1)}°`;
 * });
 * ```
 *
 * @module sunStudy
 */
export * from "./SunPosition";
export * from "./SunStudyParams";
export * from "./SunStudy";
export * from "./AnnualSunPlayerParams";
export * from "./AnnualSunPlayer";
