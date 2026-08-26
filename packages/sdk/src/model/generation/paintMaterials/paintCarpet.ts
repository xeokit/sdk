/**
 * Painter for cut-pile carpet PBR material.
 *
 * @module generation/paintMaterials/paintCarpet
 */

import type {MaterialMaps} from "./MaterialMaps";
import {
  clamp01,
  flatMR,
  heightToNormal,
  newPixelBuffer,
  periodicFbm,
  periodicHash2
} from "./utils";

/** Options accepted by {@link paintCarpet}. */
export interface PaintCarpetOptions {
  /** Loop tufts across the texture's width. Default `32`. */
  cols?: number;
  /** Loop tufts across the texture's height. Default `32`. */
  rows?: number;
  /** Carpet base colour in `[0..1]³`. Default `[0.40, 0.32, 0.28]` (warm taupe). */
  color?: [number, number, number];
  /** Per-pixel fibre speckle amplitude in `[0..1]`. Default `0.10`. */
  speckle?: number;
  /** Per-tuft tint jitter amplitude in `[0..1]`. Default `0.06`. */
  tuftJitter?: number;
  /** Period of the soft macro-shade fBm, in lattice cells. Default `5`. */
  shadePeriod?: number;
  /** `heightToNormal` strength. Default `2.5`. */
  normalStrength?: number;
  /** Uniform roughness in `[0..1]`. Default `0.95`. */
  roughness?: number;
}

/**
 * Cut-pile carpet. A `cols × rows` lattice of soft tuft domes provides
 * a regular pile structure, layered with a low-frequency fBm shade
 * pass so the surface reads as rolled fabric rather than a printed
 * grid. Per-pixel speckle adds the fine fibre breakup characteristic
 * of woven yarn, and per-tuft hue jitter prevents the colour from
 * looking flat. The heightfield drives a tangent-space normal map for
 * directional pile relief. Non-metal, very high roughness.
 */
export function paintCarpet(size: number, options: PaintCarpetOptions = {}): MaterialMaps {
  const COLS = options.cols ?? 32;
  const ROWS = options.rows ?? 32;
  const cellW = size / COLS;
  const cellH = size / ROWS;
  const baseColor      = options.color          ?? [0.40, 0.32, 0.28];
  const speckleAmp     = options.speckle        ?? 0.10;
  const tuftJitterAmp  = options.tuftJitter     ?? 0.06;
  const shadePeriod    = options.shadePeriod    ?? 5;
  const normalStrength = options.normalStrength ?? 2.5;
  const roughness      = options.roughness      ?? 0.95;

  // Heightfield: per-tuft cosine dome (1 at cell centre, 0 at corners)
  // plus a low-amplitude fBm so the pile doesn't read as a printed
  // grid.
  const hgt = newPixelBuffer(size);
  const hd = hgt.data;
  const sf = shadePeriod / size;
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / cellH);
    const yInCell = (y - row * cellH) / cellH;
    for (let x = 0; x < size; x++) {
      const col = Math.floor(x / cellW);
      const xInCell = (x - col * cellW) / cellW;
      // Centre of each loop is at cellCentre; cosine dome falls off
      // smoothly to the cell edges so adjacent tufts merge softly.
      const dome =
        0.5 * (1 + Math.cos((xInCell - 0.5) * Math.PI * 2)) *
        0.5 * (1 + Math.cos((yInCell - 0.5) * Math.PI * 2));
      const macro = periodicFbm(x * sf, y * sf, shadePeriod, shadePeriod, 4);
      const h = clamp01(0.25 + 0.55 * dome + 0.20 * (macro - 0.5));
      const i = (y * size + x) * 4;
      const v = Math.round(h * 255);
      hd[i] = hd[i + 1] = hd[i + 2] = v;
      hd[i + 3] = 255;
    }
  }

  // Colour map: base colour modulated by per-tuft hue jitter, soft
  // macro shade, and per-pixel speckle.
  const color = newPixelBuffer(size);
  const cd = color.data;
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / cellH);
    for (let x = 0; x < size; x++) {
      const col = Math.floor(x / cellW);
      const tuftId = periodicHash2(col, row, COLS, ROWS);
      const tint = (tuftId - 0.5) * 2 * tuftJitterAmp;
      const speckle = (periodicHash2(x, y, size, size) - 0.5) * speckleAmp;
      const macro = periodicFbm(x * sf, y * sf, shadePeriod, shadePeriod, 4);
      const shade = (macro - 0.5) * 0.10;
      const i = (y * size + x) * 4;
      cd[i    ] = Math.round(clamp01(baseColor[0] * (1 + tint + shade) + speckle) * 255);
      cd[i + 1] = Math.round(clamp01(baseColor[1] * (1 + tint + shade) + speckle * 0.85) * 255);
      cd[i + 2] = Math.round(clamp01(baseColor[2] * (1 + tint + shade) + speckle * 0.70) * 255);
      cd[i + 3] = 255;
    }
  }

  return {
    color,
    normal: heightToNormal(hgt, normalStrength),
    mr: flatMR(size, roughness, 0.0),
    flatColor: baseColor,
  };
}
