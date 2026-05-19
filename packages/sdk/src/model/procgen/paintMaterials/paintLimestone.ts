/**
 * Painter for limestone PBR material.
 *
 * @module procgen/paintMaterials/paintLimestone
 */

import type {MaterialMaps} from "./MaterialMaps";
import {
  clamp01,
  flatMR,
  heightToNormal,
  newPixelBuffer,
  periodicFbm
} from "./utils";

/** Options accepted by {@link paintLimestone}. */
export interface PaintLimestoneOptions {
  /** Period of the colour/heightfield fBm in lattice cells. Default `9`. */
  noisePeriod?: number;
  /** Base colour. Default `[0.764, 0.718, 0.608]`. */
  color?: [number, number, number];
  /** `heightToNormal` strength. Default `2.5`. */
  normalStrength?: number;
  /** Uniform roughness in `[0..1]`. Default `0.88`. */
  roughness?: number;
}

/**
 * Warm cream limestone. Colour and heightfield share an fBm with a
 * shorter period and one extra octave than the concrete painter,
 * giving more pronounced relief. Uniform high-roughness dielectric.
 */
export function paintLimestone(size: number, options: PaintLimestoneOptions = {}): MaterialMaps {
  const PERIOD = options.noisePeriod   ?? 9;
  const baseColor = options.color      ?? [0.764, 0.718, 0.608];
  const normalStrength = options.normalStrength ?? 2.5;
  const roughness      = options.roughness      ?? 0.88;

  const hgt = newPixelBuffer(size);
  const color = newPixelBuffer(size);
  const hd = hgt.data;
  const cd = color.data;
  const f = PERIOD / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = periodicFbm(x * f, y * f, PERIOD, PERIOD, 5, 2.1, 0.55);
      const m = (n - 0.5) * 0.22 / 0.78;
      const i = (y * size + x) * 4;
      cd[i    ] = Math.round(clamp01(baseColor[0] * (1 + m)) * 255);
      cd[i + 1] = Math.round(clamp01(baseColor[1] * (1 + m)) * 255);
      cd[i + 2] = Math.round(clamp01(baseColor[2] * (1 + m)) * 255);
      cd[i + 3] = 255;
      const h = Math.round(n * 255);
      hd[i] = hd[i + 1] = hd[i + 2] = h;
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
