/**
 * Painter for copper roof-cladding PBR material.
 *
 * @module generation/paintMaterials/paintCopperRoof
 */

import type {MaterialMaps} from "./MaterialMaps";
import {
  clamp01,
  heightToNormal,
  newPixelBuffer,
  paintMR,
  periodicFbm
} from "./utils";

/** Options accepted by {@link paintCopperRoof}. */
export interface PaintCopperRoofOptions {
  /** Period of the patina-mask fBm in lattice cells. Default `3`. */
  noisePeriod?: number;
  /**
   * Number of standing seams running across the U axis. The painter
   * wants seams oriented along the down-slope (V) axis, so the seam
   * count is the number of vertical strips per tile. Default `8`.
   */
  seamCount?: number;
  /** Half-width of the seam ridge in pixels. Default `2`. */
  seamWidth?: number;
  /** Aged-copper base. Default `[0.50, 0.28, 0.16]`. */
  copperColor?: [number, number, number];
  /** Bright-copper highlight inside seam crests. Default `[0.78, 0.45, 0.24]`. */
  copperHighlight?: [number, number, number];
  /** Deep verdigris (oxidised copper carbonate). Default `[0.18, 0.50, 0.42]`. */
  patinaColor?: [number, number, number];
  /** Brighter verdigris accent. Default `[0.40, 0.78, 0.60]`. */
  patinaHighlight?: [number, number, number];
  /**
   * Coverage in `[0..1]`. Threshold applied to the normalised fBm
   * mask — higher → more green. Default `0.50`.
   */
  patinaCoverage?: number;
  /** Roughness on bare-copper regions. Default `0.30`. */
  copperRoughness?: number;
  /** Roughness on patinated regions. Default `0.85`. */
  patinaRoughness?: number;
  /** `heightToNormal` strength for surface relief. Default `2.0`. */
  normalStrength?: number;
}

/**
 * Copper roof cladding with verdigris corrosion. Discoloration is
 * driven by a single fBm patina mask that controls all four maps in
 * lockstep — colour, metallic, roughness and surface relief — so the
 * green patches read as physical corrosion rather than a tinted paint.
 *
 *   - **Color** lerps from aged copper through bright verdigris flake
 *     to deep patina as the mask climbs through `patinaCoverage`.
 *   - **Metallic** flips from `1.0` (bare copper, tinted Fresnel
 *     reflector) to `0.0` (verdigris, a copper-carbonate dielectric)
 *     across the same threshold.
 *   - **Roughness** climbs from `copperRoughness` to `patinaRoughness`
 *     so the patinated patches kill the IBL specular and look matte.
 *   - **Normal** combines a standing-seam ridge field with the fBm
 *     micro-relief, then bumps the patina patches further. Seams run
 *     along the V axis (down-slope), the convention for traditional
 *     batten-and-seam copper roofing.
 */
export function paintCopperRoof(size: number, options: PaintCopperRoofOptions = {}): MaterialMaps {
  const PERIOD          = options.noisePeriod      ?? 3;
  const FINE_PERIOD     = PERIOD * 4;
  const seamCount       = options.seamCount        ?? 8;
  const seamWidth       = options.seamWidth        ?? 2;
  const copperColor     = options.copperColor      ?? [0.50, 0.28, 0.16];
  const copperHL        = options.copperHighlight  ?? [0.78, 0.45, 0.24];
  const patinaColor     = options.patinaColor      ?? [0.18, 0.50, 0.42];
  const patinaHL        = options.patinaHighlight  ?? [0.40, 0.78, 0.60];
  const coverage        = options.patinaCoverage   ?? 0.50;
  const copperRough     = options.copperRoughness  ?? 0.30;
  const patinaRough     = options.patinaRoughness  ?? 0.85;
  const normStrength    = options.normalStrength   ?? 2.0;

  const seamSpacing = size / seamCount;

  const color = newPixelBuffer(size);
  const cd = color.data;
  const hgt = newPixelBuffer(size);
  const hd = hgt.data;

  // Cache the patina mask for the MR painter to read back without
  // recomputing fBm.
  const mask = new Float32Array(size * size);

  const fCoarse = PERIOD / size;
  const fFine   = FINE_PERIOD / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const coarse = periodicFbm(x * fCoarse, y * fCoarse, PERIOD,      PERIOD,      4);
      const fine   = periodicFbm(x * fFine,   y * fFine,   FINE_PERIOD, FINE_PERIOD, 3);
      const m = clamp01(coarse * 0.85 + fine * 0.30 - 0.05);
      const idx = y * size + x;
      mask[idx] = m;

      // Smooth the patina threshold over a small band to avoid a
      // hard step.
      const t = clamp01((m - (coverage - 0.10)) / 0.20);

      // Standing seam profile — distance from the nearest seam line in
      // pixels, normalised to [0..1] across the seam half-width. Inside
      // the ridge band the value drops below 1 and we can lift the
      // height field plus tint toward the bright-copper accent.
      const distToSeam = Math.abs(((x + seamSpacing * 0.5) % seamSpacing) - seamSpacing * 0.5);
      const seamFalloff = clamp01(1 - distToSeam / seamWidth);
      // Squared falloff so the ridge tapers smoothly; no hard edge.
      const seamWeight = seamFalloff * seamFalloff;

      // Colour mix:
      //  1. Within the bare-copper band, lerp toward the seam highlight.
      //  2. Within the patina band, lerp between deep and bright patina
      //     using the fine fBm noise — captures the variety between
      //     freshly oxidised crust and old, dark, set patina.
      const cR = copperColor[0] * (1 - seamWeight * 0.6) + copperHL[0] * seamWeight * 0.6;
      const cG = copperColor[1] * (1 - seamWeight * 0.6) + copperHL[1] * seamWeight * 0.6;
      const cB = copperColor[2] * (1 - seamWeight * 0.6) + copperHL[2] * seamWeight * 0.6;

      const pMix = clamp01(fine);
      const pR = patinaColor[0] * (1 - pMix) + patinaHL[0] * pMix;
      const pG = patinaColor[1] * (1 - pMix) + patinaHL[1] * pMix;
      const pB = patinaColor[2] * (1 - pMix) + patinaHL[2] * pMix;

      const r = cR * (1 - t) + pR * t;
      const g = cG * (1 - t) + pG * t;
      const b = cB * (1 - t) + pB * t;

      const i = idx * 4;
      cd[i    ] = Math.round(clamp01(r) * 255);
      cd[i + 1] = Math.round(clamp01(g) * 255);
      cd[i + 2] = Math.round(clamp01(b) * 255);
      cd[i + 3] = 255;

      // Height field — base mid-grey plus seam ridge plus mild fBm
      // texture, with patina bumping the surface further so the
      // oxidised patches read as physically textured.
      const seamRidge = seamWeight * 0.45;
      const fineBump  = (fine - 0.5) * 0.18;
      const patinaBump = (fine - 0.5) * t * 0.30;
      const h = clamp01(0.5 + seamRidge + fineBump + patinaBump);
      const hb = Math.round(h * 255);
      hd[i] = hd[i + 1] = hd[i + 2] = hb;
      hd[i + 3] = 255;
    }
  }

  const mr = paintMR(size, (x, y) => {
    const m = mask[y * size + x];
    const t = clamp01((m - (coverage - 0.10)) / 0.20);
    const r = copperRough * (1 - t) + patinaRough * t;
    const met = 1 - t;
    return [r, met];
  });

  return {
    color,
    normal: heightToNormal(hgt, normStrength),
    mr,
    // Default copper-roof renders mostly weathered, so the
    // patina (verdigris) colour is the dominant flat read.
    // Callers who override `coverage = 0` get raw copper —
    // they should also override flatColor in `entry.material`
    // if they care about the swatch.
    flatColor: patinaColor,
  };
}
