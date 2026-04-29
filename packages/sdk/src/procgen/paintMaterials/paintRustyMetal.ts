/**
 * Painter for rusty-metal PBR material.
 *
 * @module procgen/paintMaterials/paintRustyMetal
 */

import type {MaterialMaps} from "./MaterialMaps";
import {
  clamp01,
  heightToNormal,
  newPixelBuffer,
  paintMR,
  periodicFbm
} from "./utils";

/** Options accepted by {@link paintRustyMetal}. */
export interface PaintRustyMetalOptions {
  /** Period of the rust-mask fBm in lattice cells. Default `4`. */
  noisePeriod?: number;
  /** Bare-metal F0. Default `[0.58, 0.58, 0.60]` (cool steel grey). */
  metalColor?: [number, number, number];
  /** Deep-rust albedo. Default `[0.42, 0.18, 0.07]`. */
  rustColor?: [number, number, number];
  /** Bright-rust accent (oxidised flake highlight). Default `[0.78, 0.36, 0.14]`. */
  rustHighlight?: [number, number, number];
  /**
   * Coverage in `[0..1]`. Higher → more rust. Threshold applied to the
   * normalised fBm mask. Default `0.55`.
   */
  rustCoverage?: number;
  /** Roughness on bare-metal regions. Default `0.30`. */
  metalRoughness?: number;
  /** Roughness on rusted regions. Default `0.95` (matte oxide). */
  rustRoughness?: number;
  /** `heightToNormal` strength. Default `1.6` (deep pitting on rust). */
  normalStrength?: number;
}

/**
 * Rusty steel — patches of bare metal corroded by deep rust, with the
 * oxide running matte and dielectric and the surviving metal staying
 * mirror-smooth and metallic. The discoloration is driven by a single
 * fBm mask that controls all four maps in lockstep:
 *
 *   - **Color** lerps from steel grey through bright-orange flake to
 *     deep oxide brown as the mask climbs through `rustCoverage`.
 *   - **Metallic** flips from `1.0` (bare metal) to `0.0` (oxide) at
 *     the same threshold — rust is a dielectric and shouldn't read as
 *     a tinted Fresnel mirror.
 *   - **Roughness** climbs from `metalRoughness` to `rustRoughness`,
 *     so the rusty patches kill the IBL specular and look matte.
 *   - **Normal** is built from a height field that's flat on metal and
 *     bumpy on rust, so the oxide reads as physically pitted.
 *
 * Two octaves of fine fBm are mixed in on top of the coarse mask to
 * roughen the rust/metal boundary into the chipped, irregular edge a
 * uniform threshold would otherwise miss.
 */
export function paintRustyMetal(size: number, options: PaintRustyMetalOptions = {}): MaterialMaps {
  const PERIOD       = options.noisePeriod   ?? 4;
  const FINE_PERIOD  = PERIOD * 4;
  const metalColor   = options.metalColor    ?? [0.58, 0.58, 0.60];
  const rustColor    = options.rustColor     ?? [0.42, 0.18, 0.07];
  const rustHL       = options.rustHighlight ?? [0.78, 0.36, 0.14];
  const coverage     = options.rustCoverage  ?? 0.55;
  const metalRough   = options.metalRoughness ?? 0.30;
  const rustRough    = options.rustRoughness  ?? 0.95;
  const normStrength = options.normalStrength ?? 1.6;

  const color = newPixelBuffer(size);
  const cd = color.data;
  const hgt = newPixelBuffer(size);
  const hd = hgt.data;

  // Cache the rust mask so the MR painter below can read it back
  // without recomputing the fBm.
  const mask = new Float32Array(size * size);

  const fCoarse = PERIOD / size;
  const fFine   = FINE_PERIOD / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const coarse = periodicFbm(x * fCoarse, y * fCoarse, PERIOD,      PERIOD,      4);
      const fine   = periodicFbm(x * fFine,   y * fFine,   FINE_PERIOD, FINE_PERIOD, 3);
      // Coarse mask drives the patch shape; fine mask roughens the edge.
      const m = clamp01(coarse * 0.85 + fine * 0.30 - 0.05);
      const idx = y * size + x;
      mask[idx] = m;

      // Smooth the threshold over a small band so rust/metal doesn't
      // alias to a hard step. `t` ramps 0 → 1 across `coverage ± 0.10`.
      const t = clamp01((m - (coverage - 0.10)) / 0.20);

      // Within the rust band, modulate between the dark oxide colour
      // and a brighter accent driven by the fine noise — captures the
      // visual variety between deep flake and freshly oxidised crust.
      const rustMix = clamp01(fine);
      const r0 = rustColor[0] * (1 - rustMix) + rustHL[0] * rustMix;
      const g0 = rustColor[1] * (1 - rustMix) + rustHL[1] * rustMix;
      const b0 = rustColor[2] * (1 - rustMix) + rustHL[2] * rustMix;

      const r = metalColor[0] * (1 - t) + r0 * t;
      const g = metalColor[1] * (1 - t) + g0 * t;
      const b = metalColor[2] * (1 - t) + b0 * t;

      const i = idx * 4;
      cd[i    ] = Math.round(clamp01(r) * 255);
      cd[i + 1] = Math.round(clamp01(g) * 255);
      cd[i + 2] = Math.round(clamp01(b) * 255);
      cd[i + 3] = 255;

      // Height field — bare metal stays at mid-grey (no perturbation
      // after heightToNormal); rust raises and pits the surface based
      // on the fine octave so the oxide reads as physically textured.
      const h = 0.5 + (t - 0.5) * 0.0 + (fine - 0.5) * t * 0.9;
      const hb = Math.round(clamp01(h) * 255);
      hd[i] = hd[i + 1] = hd[i + 2] = hb;
      hd[i + 3] = 255;
    }
  }

  const mr = paintMR(size, (x, y) => {
    const m = mask[y * size + x];
    const t = clamp01((m - (coverage - 0.10)) / 0.20);
    // Roughness lerps with the same band; metallic snaps to 0 inside
    // the rust band so the BRDF stops treating the patch as a tinted
    // Fresnel reflector.
    const r = metalRough * (1 - t) + rustRough * t;
    const met = 1 - t;
    return [r, met];
  });

  return {
    color,
    normal: heightToNormal(hgt, normStrength),
    mr
  };
}
