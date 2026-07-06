/**
 * # Annual Daylight Analysis
 *
 * Computes direct sun hours across a horizontal work plane and can
 * convert the result to a heatmap mesh.
 *
 * Implements the time-step daylight integration used in LEED EQ
 * Credit 8.1, BREEAM Hea 01, and EN 17037 §6.2: walk the year hour
 * by hour, raycast from each work-plane sample toward the sun,
 * accumulate sunlit time for unoccluded samples.
 *
 * ## Usage
 *
 * ```ts
 * import * as xeokit from "@xeokit/sdk";
 *
 * const analysis = new xeokit.presentations.daylightAnalysis.DaylightAnalysis({
 *   sunStudy,           // existing SunStudy with site lat/lon
 *   scene,              // occluder source
 *   grid: {
 *     min: [-15, -15, 0.8],   // work-plane corner (z = floor + 800 mm)
 *     max: [ 15,  15, 0.8],
 *     resolution: [30, 30],
 *   },
 *   year:        2026,
 *   daysPerYear: 12,        // monthly cadence
 *   hoursPerDay: 24,        // hourly cadence within each day
 * });
 *
 * const result = await analysis.run((frac) => {
 *   progressBar.value = frac * 100;
 * });
 *
 * const heatmap = xeokit.presentations.daylightAnalysis.buildAnalysisHeatmap(
 *   scene, result, { opacity: 0.85 },
 * );
 * ```
 *
 * @module daylightAnalysis
 */
export * from "./DaylightAnalysisParams";
export * from "./DaylightAnalysisResult";
export * from "./DaylightAnalysis";
export * from "./buildAnalysisHeatmap";
export * from "./SkyLuminance";
