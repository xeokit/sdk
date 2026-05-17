/**
 * Painter for polished granite PBR material.
 *
 * @module procgen/paintMaterials/paintGranite
 */

import type {MaterialMaps} from "./MaterialMaps";
import {
  clamp01,
  flatMR,
  heightToNormal,
  newPixelBuffer,
  periodicHash2,
  periodicNoise2
} from "./utils";

/** Options accepted by {@link paintGranite}. */
export interface PaintGraniteOptions {
  /** Dark biotite stop. Default `[0.18, 0.18, 0.20]`. */
  darkColor?: [number, number, number];
  /** Mid-grey matrix stop. Default `[0.50, 0.50, 0.51]`. */
  midColor?: [number, number, number];
  /** Light feldspar stop. Default `[0.97, 0.97, 0.96]`. */
  lightColor?: [number, number, number];
  /** Pink fleck stop. Default `[0.86, 0.62, 0.58]`. */
  fleckColor?: [number, number, number];
  /** Per-pixel-hash threshold above which a fleck is placed. Default `0.97`. */
  fleckThreshold?: number;
  /** Period of the matrix cluster noise in lattice cells. Default `16`. */
  clusterPeriod?: number;
  /** `heightToNormal` strength. Default `0.6`. */
  normalStrength?: number;
  /** Uniform roughness in `[0..1]`. Default `0.42`. */
  roughness?: number;
}

/**
 * Polished granite. A 4-stop palette (`darkColor`, `midColor`,
 * `lightColor`, `fleckColor`) is selected per pixel from two
 * non-correlated periodic hashes. A large-cell cluster noise
 * modulates the matrix stop. Non-metal.
 */
export function paintGranite(size: number, options: PaintGraniteOptions = {}): MaterialMaps {
  const darkColor   = options.darkColor   ?? [0.18, 0.18, 0.20];
  const midColor    = options.midColor    ?? [0.50, 0.50, 0.51];
  const lightColor  = options.lightColor  ?? [0.97, 0.97, 0.96];
  const fleckColor  = options.fleckColor  ?? [0.86, 0.62, 0.58];
  const fleckThreshold = options.fleckThreshold ?? 0.97;
  const CLUSTER     = options.clusterPeriod  ?? 16;
  const normalStrength = options.normalStrength ?? 0.6;
  const roughness      = options.roughness      ?? 0.42;

  const hgt = newPixelBuffer(size);
  const color = newPixelBuffer(size);
  const hd = hgt.data;
  const cd = color.data;
  const cf = CLUSTER / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const grain = periodicHash2(x,         y,         size, size);
      const speck = periodicHash2(x + 137,   y + 251,   size, size);
      const cluster = periodicNoise2(x * cf, y * cf, CLUSTER, CLUSTER);
      let r: number, g: number, b: number;
      if      (speck > fleckThreshold) { r = fleckColor[0]; g = fleckColor[1]; b = fleckColor[2]; }
      else if (grain > 0.86)           { r = lightColor[0]; g = lightColor[1]; b = lightColor[2]; }
      else if (grain < 0.18)           { r = darkColor[0];  g = darkColor[1];  b = darkColor[2];  }
      else {
        const t = 1 + (cluster - 0.5) * 0.20;
        r = midColor[0] * t; g = midColor[1] * t; b = midColor[2] * t;
      }
      const i = (y * size + x) * 4;
      cd[i    ] = Math.round(clamp01(r) * 255);
      cd[i + 1] = Math.round(clamp01(g) * 255);
      cd[i + 2] = Math.round(clamp01(b) * 255);
      cd[i + 3] = 255;
      const h = Math.round((0.4 + grain * 0.6) * 255);
      hd[i] = hd[i + 1] = hd[i + 2] = h;
      hd[i + 3] = 255;
    }
  }
  return {
    color,
    normal: heightToNormal(hgt, normalStrength),
    mr: flatMR(size, roughness, 0.0)
  };
}
