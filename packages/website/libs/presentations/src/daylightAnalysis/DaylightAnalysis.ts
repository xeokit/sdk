import type {DaylightAnalysisParams} from "./DaylightAnalysisParams";
import type {DaylightAnalysisResult} from "./DaylightAnalysisResult";
import {computeSunPosition, sunDirection} from "../sunStudy/SunPosition";
import {getSceneCollisionIndex} from "@xeokit/sdk/spatial/collision";
import {yieldToHost} from "@xeokit/sdk/base/utils";
import {
  makeHemisphereSamples,
  skyFactorEstimate,
  skyHorizontalIlluminance,
} from "./SkyLuminance";


// Screening-grade direct-normal illuminance in lux at peak —
// a stand-in for the Perez clear-sky DNI of ~100 klux at noon
// on a clear day. Horizontal component is `DNI · sin(altitude)`.
const PEAK_DIRECT_NORMAL_LUX = 100000;


/**
 * Computes annual cumulative direct-sun hours on a horizontal work
 * plane for daylight analysis (LEED EQ 8.1, BREEAM Hea 01,
 * EN 17037 §6.2) and massing studies.
 *
 * ## What it does
 *
 * For each cell on the supplied {@link AnalysisGrid | work-plane grid},
 * for each evaluated `(day, hour)` time-sample across the year:
 *
 * 1. Computes the sun's position from the site lat/lon (taken from
 *    the supplied {@link SunStudy}) using the NOAA Solar Position
 *    Algorithm in {@link presentations!sunStudy.computeSunPosition}.
 * 2. Skips the sample if the sun is below `minSunAltitudeDeg`.
 * 3. Casts a ray from the cell centre toward the sun against the
 *    Scene's collision index (BVH-of-object-AABBs).
 * 4. If the ray is unobstructed, accumulates one sample-interval's
 *    worth of "direct-sun hours" into the cell's running total.
 *
 * After every cell completes, the runner yields cooperatively via
 * the SDK's {@link base!utils.yieldToHost | yieldToHost}; callers can
 * use the progress callback to update UI.
 *
 * ## Defaults
 *
 * - Time resolution: 12 days × 24 hours = 288 samples per cell, the
 *   "Cambridge / BBR daylight protocol" cadence — one day per month,
 *   hourly through each evaluated day.
 * - Spatial resolution: caller-supplied (`grid.resolution`).
 * - Occlusion test: object-AABB-level via the collision index's
 *   `intersectRay`. Conservative on the "shadow" side: a ray that
 *   clips through a corner of an AABB but misses the geometry is
 *   counted as occluded.
 *
 * ## Performance
 *
 * For a 30×30 grid with default 288 samples per cell, expect ~260k
 * ray casts total. The BVH does each in O(log n) AABB tests; on a
 * mid-spec laptop the run finishes in 1–3 seconds for a single-building
 * model, scaling roughly linearly with `nx × ny × samples`.
 *
 * @module presentations/daylightAnalysis
 */
export class DaylightAnalysis {

  public readonly params: DaylightAnalysisParams;

  constructor(params: DaylightAnalysisParams) {
    if (!params || !params.sunStudy || !params.scene || !params.grid) {
      throw new Error("[DaylightAnalysis] sunStudy, scene, and grid are required");
    }
    this.params = params;
  }

  /**
   * Run the analysis. Returns a {@link DaylightAnalysisResult}
   * containing per-cell sunlit-hour totals plus min / max / mean.
   *
   * @param onProgress  Optional progress callback. Receives a value
   *                    in `[0, 1]` after each row of cells completes
   *                    (not every cell).
   */
  public async run(
    onProgress?: (fraction: number) => void,
  ): Promise<DaylightAnalysisResult> {

    const p = this.params;
    const [nx, ny] = p.grid.resolution;
    if (nx < 1 || ny < 1) {
      throw new Error("[DaylightAnalysis] grid.resolution must be ≥ 1 along each axis");
    }

    const year         = p.year         ?? new Date().getUTCFullYear();
    const daysPerYear  = p.daysPerYear  ?? 12;
    const hoursPerDay  = p.hoursPerDay  ?? 24;
    const minAltitude  = p.minSunAltitudeDeg ?? 5;
    const yieldIntMs   = p.yieldIntervalMs ?? 16;
    const skyModel     = p.skyModel ?? "none";
    const skySamples   = Math.max(1, Math.floor(p.skySamples ?? 64));

    const lat = p.sunStudy.latitude;
    const lon = p.sunStudy.longitude;
    const northR = (p.sunStudy.northAngleDegrees * Math.PI) / 180;
    const sampleIntervalHours = 24 / hoursPerDay;

    const collisionIndex = getSceneCollisionIndex(p.scene);

    // ── Pre-compute the sample times ─────────────────────────────
    // Days are evenly spaced through the year so a `daysPerYear: 12`
    // run lands on (roughly) the 15th of each month — the long-
    // standard "design day" for compliance analyses.
    const yearStartMs = Date.UTC(year, 0, 1);
    const msPerYear   = (Date.UTC(year + 1, 0, 1) - yearStartMs);
    const dayMs: number[] = new Array(daysPerYear);
    for (let i = 0; i < daysPerYear; i++) {
      dayMs[i] = yearStartMs + Math.floor((i + 0.5) * msPerYear / daysPerYear);
      // Snap to day boundary so the hour sweep is clean.
      dayMs[i] = dayMs[i] - (dayMs[i] - yearStartMs) % (24 * 60 * 60 * 1000);
    }

    // ── Pre-compute sun directions for every sample time ─────────
    // Site-relative, so per-cell raycasts only do BVH work. Memory
    // is light: 12 × 24 × 3 floats = 864 bytes for the default,
    // even a daily / hourly run is 365 × 24 × 3 = ~26 KB.
    //
    // `sinAlt` carries sin(altitude) per usable sample so the
    // direct-sun pass can convert visibility into horizontal
    // illuminance (`DNI · sin(altitude)`) when the sky model adds
    // an absolute-units term to the result.
    const totalSamples = daysPerYear * hoursPerDay;
    const dirs   = new Float32Array(totalSamples * 3);
    const sinAlt = new Float32Array(totalSamples);
    const usable = new Uint8Array(totalSamples); // 1 = above min altitude
    const scratchSunDir = new Float32Array(3);

    // Per-time-sample sky horizontal illuminance for an unobstructed
    // cell — depends only on the sun altitude under the chosen
    // model, not on the cell, so we materialise once per run and
    // weight each cell by its scalar SVF.
    const skyHorizLux = new Float32Array(totalSamples);

    let s = 0;
    for (let di = 0; di < daysPerYear; di++) {
      for (let hi = 0; hi < hoursPerDay; hi++) {
        const tMs = dayMs[di] + (hi * sampleIntervalHours + sampleIntervalHours / 2) * 60 * 60 * 1000;
        const sun = computeSunPosition(new Date(tMs), lat, lon);
        if (sun.altitude >= minAltitude) {
          sunDirection(sun, northR, scratchSunDir);
          dirs[s * 3    ] = scratchSunDir[0];
          dirs[s * 3 + 1] = scratchSunDir[1];
          dirs[s * 3 + 2] = scratchSunDir[2];
          sinAlt[s] = Math.sin((sun.altitude * Math.PI) / 180);
          usable[s] = 1;
        }
        if (skyModel !== "none") {
          // Sky stays bright as long as the sun is above the horizon
          // (alt > 0), not just above `minAltitude` — civil twilight
          // skylight is still meaningful.
          if (sun.altitude > 0) {
            skyHorizLux[s] = skyHorizontalIlluminance(skyModel, (sun.altitude * Math.PI) / 180);
          }
        }
        s++;
      }
    }

    // Annual unobstructed sky illuminance integrated across the
    // year — a single scalar each cell scales by its SVF.
    let skyLuxHoursUnobstructed = 0;
    if (skyModel !== "none") {
      for (let i = 0; i < totalSamples; i++) {
        skyLuxHoursUnobstructed += skyHorizLux[i] * sampleIntervalHours;
      }
    }

    // Hemisphere sample directions — generated once per run, reused
    // by every cell that needs an SVF.
    const hemiDirs = (skyModel !== "none")
      ? makeHemisphereSamples(skySamples)
      : null;

    // ── Sweep the grid ───────────────────────────────────────────
    const ncells       = nx * ny;
    const directHours  = new Float32Array(ncells);
    const skyFactor    = (skyModel !== "none") ? new Float32Array(ncells) : null;
    const values       = new Float32Array(ncells);   // hours, or klux·hours
    const [minX, minY, minZ] = p.grid.min;
    const [maxX, maxY, maxZ] = p.grid.max;
    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const spanZ = maxZ - minZ;
    const origin: [number, number, number] = [0, 0, 0];
    const toSun: [number, number, number]  = [0, 0, 0];
    const hemiRay: [number, number, number] = [0, 0, 0];
    const biased: [number, number, number]  = [0, 0, 0];
    // Reused per cell when the sky pass is active — collects the
    // zenith cosines of visible hemisphere samples so
    // `skyFactorEstimate` can apply the right luminance weighting.
    const visibleCosThetas: number[] = [];
    let lastYieldMs = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

    let minV = Infinity, maxV = -Infinity, sumV = 0;

    for (let iy = 0; iy < ny; iy++) {
      const ty = (ny === 1) ? 0.5 : (iy + 0.5) / ny;
      for (let ix = 0; ix < nx; ix++) {
        const tx = (nx === 1) ? 0.5 : (ix + 0.5) / nx;
        origin[0] = minX + tx * spanX;
        origin[1] = minY + ty * spanY;
        origin[2] = minZ + 0.5 * spanZ;

        // ── Direct-sun pass ─────────────────────────────────────
        let hours      = 0;
        let directLux  = 0;   // lux-hours accumulated for this cell
        for (let si = 0; si < totalSamples; si++) {
          if (!usable[si]) continue;
          toSun[0] = -dirs[si * 3    ];
          toSun[1] = -dirs[si * 3 + 1];
          toSun[2] = -dirs[si * 3 + 2];

          // Bias origin along ray to avoid self-intersection with
          // the surface the cell sits on.
          biased[0] = origin[0] + toSun[0] * 0.05;
          biased[1] = origin[1] + toSun[1] * 0.05;
          biased[2] = origin[2] + toSun[2] * 0.05;

          const hits = collisionIndex.intersectRay(biased, toSun);
          if (hits.length === 0) {
            hours     += sampleIntervalHours;
            directLux += PEAK_DIRECT_NORMAL_LUX * sinAlt[si] * sampleIntervalHours;
          }
        }
        directHours[iy * nx + ix] = hours;

        // ── Sky pass ────────────────────────────────────────────
        // Cosine-weighted hemisphere raycast against the BVH; for
        // each sample that escapes, remember its zenith cosine so
        // the chosen sky model can weight it correctly.
        let skyLux = 0;
        if (skyModel !== "none" && hemiDirs) {
          visibleCosThetas.length = 0;
          for (let hi = 0; hi < skySamples; hi++) {
            hemiRay[0] = hemiDirs[hi * 3    ];
            hemiRay[1] = hemiDirs[hi * 3 + 1];
            hemiRay[2] = hemiDirs[hi * 3 + 2];

            biased[0] = origin[0] + hemiRay[0] * 0.05;
            biased[1] = origin[1] + hemiRay[1] * 0.05;
            biased[2] = origin[2] + hemiRay[2] * 0.05;

            const hits = collisionIndex.intersectRay(biased, hemiRay);
            if (hits.length === 0) {
              visibleCosThetas.push(hemiRay[2]);
            }
          }
          const svf = skyFactorEstimate(skyModel, skySamples, visibleCosThetas);
          skyFactor![iy * nx + ix] = svf;
          skyLux = svf * skyLuxHoursUnobstructed;
        }

        // ── Combine ─────────────────────────────────────────────
        // values carries hours when sky off, klux·hours otherwise.
        const cellValue = (skyModel === "none")
          ? hours
          : (directLux + skyLux) / 1000;
        values[iy * nx + ix] = cellValue;
        if (cellValue < minV) minV = cellValue;
        if (cellValue > maxV) maxV = cellValue;
        sumV += cellValue;
      }

      // Progress + cooperative yield. Once per row keeps the
      // callback rate manageable on small grids while still feeling
      // smooth.
      onProgress?.((iy + 1) / ny);
      const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      if (now - lastYieldMs >= yieldIntMs) {
        await yieldToHost(undefined, yieldIntMs);
        lastYieldMs = now;
      }
    }

    if (!isFinite(minV)) minV = 0;
    if (!isFinite(maxV)) maxV = 0;

    return {
      values,
      min:  minV,
      max:  maxV,
      mean: sumV / ncells,
      grid: p.grid,
      unit: (skyModel === "none") ? "hours" : "klux-hours",
      year,
      hoursPerDay,
      daysEvaluated: daysPerYear,
      skyModel,
      directHours,
      skyFactor,
    };
  }
}
