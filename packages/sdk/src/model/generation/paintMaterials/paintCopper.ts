/**
 * Painter for copper PBR material.
 *
 * @module generation/paintMaterials/paintCopper
 */

import type {MaterialMaps} from "./MaterialMaps";
import {
  clamp01,
  flatMR,
  heightToNormal,
  newPixelBuffer,
  periodicFbm
} from "./utils";

/** Options accepted by {@link paintCopper}. */
export interface PaintCopperOptions {
  /** Period of the patina-drift fBm in lattice cells. Default `10`. */
  noisePeriod?: number;
  /** Copper F0 colour. Default `[0.88, 0.50, 0.28]`. */
  color?: [number, number, number];
  /** `heightToNormal` strength. Default `0.4`. */
  normalStrength?: number;
  /** Uniform roughness in `[0..1]`. Default `0.15`. */
  roughness?: number;
}

/**
 * Copper. Warm orange-brown F0 with low-amplitude fBm-driven patina
 * drift in colour and heightfield. Metallic 1.0.
 */
export function paintCopper(size: number, options: PaintCopperOptions = {}): MaterialMaps {
  const PERIOD = options.noisePeriod ?? 10;
  const baseColor = options.color    ?? [0.88, 0.50, 0.28];
  const normalStrength = options.normalStrength ?? 0.4;
  const roughness      = options.roughness      ?? 0.15;

  const color = newPixelBuffer(size);
  const cd = color.data;
  const hgt = newPixelBuffer(size);
  const hd = hgt.data;
  const f = PERIOD / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = periodicFbm(x * f, y * f, PERIOD, PERIOD, 4);
      const r = baseColor[0] + (n - 0.5) * 0.05;
      const g = baseColor[1] + (n - 0.5) * 0.04;
      const b = baseColor[2] + (n - 0.5) * 0.04;
      const i = (y * size + x) * 4;
      cd[i    ] = Math.round(clamp01(r) * 255);
      cd[i + 1] = Math.round(clamp01(g) * 255);
      cd[i + 2] = Math.round(clamp01(b) * 255);
      cd[i + 3] = 255;
      const h = Math.round(n * 255);
      hd[i] = hd[i + 1] = hd[i + 2] = h;
      hd[i + 3] = 255;
    }
  }
  return {
    color,
    normal: heightToNormal(hgt, normalStrength),
    mr: flatMR(size, roughness, 1.0),
    flatColor: baseColor,
  };
}
