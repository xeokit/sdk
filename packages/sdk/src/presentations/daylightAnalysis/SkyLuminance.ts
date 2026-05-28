/**
 * Sky-luminance models + hemisphere sampling used by
 * {@link DaylightAnalysis} when a non-`"none"` sky model is enabled.
 *
 * Two models are supported:
 *
 *   - **`"cie-overcast"`** — CIE Standard Overcast Sky (CIE 1955):
 *     `L(θ) = L_z · (1 + 2·cos θ) / 3`, where `θ` is the zenith
 *     angle. Brighter at zenith, dimmer at the horizon — the model
 *     UK BRE 209, EN 17037, and the global "daylight factor" metric
 *     are all built on. Azimuth-symmetric, sun-independent.
 *
 *   - **`"uniform"`** — Uniform luminance over the hemisphere
 *     (CIE 1 sky). Easier to reason about; useful as a baseline.
 *
 * Sky-luminance modeling here is **screening-grade**: it gives a
 * useful first approximation of how the diffuse sky contribution
 * varies across a work plane, but does not replace a path-traced
 * Radiance run for compliance-grade output. In particular: no
 * inter-reflection (light bouncing off interior surfaces), no
 * circumsolar brightening (clear-sky behaviour around the sun),
 * no atmospheric attenuation, no spectral terms.
 *
 * @module presentations/daylightAnalysis
 */

/** Supported sky-luminance models. */
export type SkyModel = "none" | "uniform" | "cie-overcast";


/**
 * Generate `n` cosine-weighted unit direction vectors over the
 * upper hemisphere (Z >= 0). Uses the Hammersley low-discrepancy
 * sequence — better stratification than uniform random for small
 * `n`, so a 64-sample hemisphere produces a smoother sky-view
 * factor estimate than 64 random samples would.
 *
 * Returned as a flat `Float32Array` of length `n * 3`.
 */
export function makeHemisphereSamples(n: number): Float32Array {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    // Hammersley sequence: (i/n, van der Corput base-2 of i).
    const u = (i + 0.5) / n;
    let v = 0, f = 0.5, bits = i;
    for (let k = 0; k < 24 && bits !== 0; k++) {
      v += (bits & 1) * f;
      bits >>>= 1;
      f *= 0.5;
    }
    // Cosine-weighted hemisphere mapping: PDF ∝ cos(θ).
    const r = Math.sqrt(u);
    const phi = 2 * Math.PI * v;
    out[i * 3    ] = r * Math.cos(phi);   // x
    out[i * 3 + 1] = r * Math.sin(phi);   // y
    out[i * 3 + 2] = Math.sqrt(1 - u);    // z = cos(θ)
  }
  return out;
}


/**
 * Compute the normalised sky factor for a cell, given how many of
 * its `n` cosine-weighted hemisphere samples were visible (escaped
 * the scene without hitting an occluder) and the cosine of the
 * zenith angle of each visible sample.
 *
 * Result is in `[0, 1]` — `1.0` means the cell sees the full
 * unobstructed sky under the chosen model, `0.0` means the cell
 * is entirely roofed over.
 *
 * The Monte Carlo estimator is derived from
 *
 * ```
 *   E_horiz = ∫_Ω L(ω) · cos(θ) dω
 *           ≈ (π/n) · Σ L(ω_i)         (cosine-weighted PDF)
 *   SkyFactor = E_horiz / E_horiz_unobstructed
 * ```
 *
 * The `E_horiz_unobstructed` analytic for each model is:
 *
 *   - Uniform        : `π · L`        → factor reduces to `visible / n`
 *   - CIE Overcast   : `(7π/9) · L_z` → factor is `3 · Σ(1 + 2·cosθ) / (7n)`
 *
 * Both are azimuth-symmetric so `cosTheta` is all the information
 * needed per sample.
 */
export function skyFactorEstimate(
  model: Exclude<SkyModel, "none">,
  n: number,
  visibleCosThetas: number[],
): number {
  if (n === 0) return 0;
  switch (model) {
    case "uniform":
      return visibleCosThetas.length / n;
    case "cie-overcast": {
      let acc = 0;
      for (let i = 0; i < visibleCosThetas.length; i++) {
        acc += 1 + 2 * visibleCosThetas[i];
      }
      return (3 * acc) / (7 * n);
    }
  }
}


/**
 * Approximate horizontal diffuse illuminance from the sky on a
 * fully unobstructed surface (lux), as a function of solar
 * altitude in radians, for the given sky model.
 *
 * Screening-grade — these aren't the per-sample-aware values a
 * Perez All-Weather model would return, but they capture the
 * dominant effect (sky is brighter when the sun is higher) and
 * give the year-integrated metric a physically-meaningful shape.
 *
 *   - **Uniform**: 10000 lux during daylight, 0 at night. A
 *     useful "compliance-style design sky" — corresponds to the
 *     classic 10,000 lux outside reference often used for
 *     daylight-factor work.
 *   - **CIE Overcast**: scales with `sin(altitude)`. Roughly
 *     8000 + 12000·sin(α) lux — peaks near 20 klux at zenith
 *     altitude, drops to 8 klux at the horizon. Above-horizon only.
 */
export function skyHorizontalIlluminance(
  model: Exclude<SkyModel, "none">,
  altitudeRad: number,
): number {
  if (altitudeRad <= 0) return 0;
  const sinAlt = Math.sin(altitudeRad);
  switch (model) {
    case "uniform":
      return 10000;
    case "cie-overcast":
      return 8000 + 12000 * sinAlt;
  }
}
