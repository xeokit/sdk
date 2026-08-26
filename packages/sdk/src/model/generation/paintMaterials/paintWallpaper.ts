/**
 * Painter for vertical-pinstripe damask wallpaper PBR material.
 *
 * @module generation/paintMaterials/paintWallpaper
 */

import type {MaterialMaps} from "./MaterialMaps";
import {
  clamp01,
  flatMR,
  heightToNormal,
  newPixelBuffer,
  periodicFbm
} from "./utils";

/** Options accepted by {@link paintWallpaper}. */
export interface PaintWallpaperOptions {
  /** Number of vertical pinstripes across the texture. Default `12`. */
  stripes?: number;
  /** Number of damask diamond motifs across the texture. Default `4`. */
  motifs?: number;
  /** Base wall colour in `[0..1]³`. Default `[0.88, 0.84, 0.76]` (cream). */
  color?: [number, number, number];
  /** Stripe-accent colour in `[0..1]³`. Default `[0.78, 0.68, 0.50]` (warm tan). */
  stripeColor?: [number, number, number];
  /** Damask-motif accent colour in `[0..1]³`. Default `[0.65, 0.50, 0.35]` (deeper tan). */
  motifColor?: [number, number, number];
  /** Pinstripe colour intensity in `[0..1]`. Default `0.45`. */
  stripeStrength?: number;
  /** Damask-motif colour intensity in `[0..1]`. Default `0.35`. */
  motifStrength?: number;
  /** Period of the soft macro fBm fade, in lattice cells. Default `3`. */
  shadePeriod?: number;
  /** `heightToNormal` strength. Default `0.4` (very shallow emboss). */
  normalStrength?: number;
  /** Uniform roughness in `[0..1]`. Default `0.55` (slight satin). */
  roughness?: number;
}

/**
 * Vertical-pinstripe damask wallpaper. Two layered patterns supply
 * the visual structure:
 *
 *   - **Pinstripes** — a high-frequency vertical sine product picks
 *     out narrow stripe bands at `stripes` repeats per width, tinted
 *     toward `stripeColor`.
 *   - **Damask motif** — a slow `|sin(x) · sin(y)|` lattice at
 *     `motifs` repeats produces an ornate diamond grid, tinted
 *     toward `motifColor` and embossed gently into the heightfield
 *     so the print catches grazing light.
 *
 * A soft fBm macro pass shifts the base colour by a few percent to
 * break the fully-flat field. Non-metal, satin roughness.
 */
export function paintWallpaper(size: number, options: PaintWallpaperOptions = {}): MaterialMaps {
  const STRIPES = options.stripes ?? 12;
  const MOTIFS  = options.motifs  ?? 4;
  const baseColor      = options.color           ?? [0.88, 0.84, 0.76];
  const stripeColor    = options.stripeColor     ?? [0.78, 0.68, 0.50];
  const motifColor     = options.motifColor      ?? [0.65, 0.50, 0.35];
  const stripeStrength = options.stripeStrength  ?? 0.45;
  const motifStrength  = options.motifStrength   ?? 0.35;
  const shadePeriod    = options.shadePeriod     ?? 3;
  const normalStrength = options.normalStrength  ?? 0.4;
  const roughness      = options.roughness       ?? 0.55;

  // Lerp `(a, b, t)` per channel with `t` clamped to `[0, 1]`. Pulled
  // up here so the inner loop stays tight.
  const mix = (a: number, b: number, t: number): number => a + (b - a) * clamp01(t);

  const hgt = newPixelBuffer(size);
  const hd = hgt.data;
  const color = newPixelBuffer(size);
  const cd = color.data;
  const sf = shadePeriod / size;
  const stripeFreq = (Math.PI * 2 * STRIPES) / size;
  const motifFreq  = (Math.PI * MOTIFS) / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {

      // Pinstripe band — narrow positive crest where cos peaks. The
      // 0.92 threshold isolates the top of each ridge so the stripe
      // reads as a thin line rather than a smooth gradient.
      const stripeRaw = Math.cos(x * stripeFreq);
      const stripe = clamp01((stripeRaw - 0.92) / 0.08);

      // Damask diamond motif — `|sin · sin|` produces a soft diamond
      // lattice. Square it for a sharper centre falloff.
      const motifRaw = Math.abs(Math.sin(x * motifFreq) * Math.sin(y * motifFreq));
      const motif = motifRaw * motifRaw;

      // Soft macro shade — barely visible fBm wash to keep the
      // background from reading as a flat fill under flat light.
      const macro = periodicFbm(x * sf, y * sf, shadePeriod, shadePeriod, 4);
      const shade = (macro - 0.5) * 0.06;

      // Colour: base → stripeColor → motifColor, each weighted by
      // its mask × strength. Stripes wash over the base first; the
      // motif overlay is layered last so it stays legible across
      // both the base and stripe regions.
      const t1 = stripe * stripeStrength;
      const t2 = motif  * motifStrength;
      const r1 = mix(baseColor[0], stripeColor[0], t1);
      const g1 = mix(baseColor[1], stripeColor[1], t1);
      const b1 = mix(baseColor[2], stripeColor[2], t1);
      const r = clamp01(mix(r1, motifColor[0], t2) + shade);
      const g = clamp01(mix(g1, motifColor[1], t2) + shade);
      const b = clamp01(mix(b1, motifColor[2], t2) + shade);

      const i = (y * size + x) * 4;
      cd[i    ] = Math.round(r * 255);
      cd[i + 1] = Math.round(g * 255);
      cd[i + 2] = Math.round(b * 255);
      cd[i + 3] = 255;

      // Heightfield: only the damask motif catches relief — stripes
      // are flat ink. A small base offset keeps the field from
      // hitting zero (which would noise up the normal-map gradient
      // around the pure-flat edges).
      const h = 0.45 + 0.55 * motif;
      const v = Math.round(h * 255);
      hd[i] = hd[i + 1] = hd[i + 2] = v;
      hd[i + 3] = 255;
    }
  }

  return {
    color,
    normal: heightToNormal(hgt, normalStrength),
    mr: flatMR(size, roughness, 0.0),
    flatColor: baseColor,
  };
}
