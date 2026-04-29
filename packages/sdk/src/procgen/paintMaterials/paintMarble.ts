/**
 * Painter for polished marble PBR material.
 *
 * @module procgen/paintMaterials/paintMarble
 */

import type {MaterialMaps} from "./MaterialMaps";
import {
  clamp01,
  flatMR,
  heightToNormal,
  newPixelBuffer,
  periodicFbm
} from "./utils";

/** Options accepted by {@link paintMarble}. */
export interface PaintMarbleOptions {
  /** Number of vein cycles across the texture. Default `12`. */
  veins?: number;
  /** Marble base colour. Default `[0.92, 0.91, 0.88]`. */
  color?: [number, number, number];
  /** Vein crest colour. Default `[0.45, 0.45, 0.43]`. */
  veinColor?: [number, number, number];
  /**
   * Period of the warp fBm in lattice cells. Sized so vein positions
   * match at the wrap. Default `8`.
   */
  warpPeriod?: number;
  /** Warp amplitude (in radians) on the vein-position phase. Default `6.0`. */
  warpStrength?: number;
  /** `heightToNormal` strength. Default `0.4`. */
  normalStrength?: number;
  /** Uniform roughness in `[0..1]`. Default `0.18`. */
  roughness?: number;
}

/**
 * Polished marble. Vein crests are produced by a sine carrier that
 * cycles `veins` times across the texture and is warped by a periodic
 * fBm. Non-metal.
 */
export function paintMarble(size: number, options: PaintMarbleOptions = {}): MaterialMaps {
  const VEINS = options.veins ?? 12;
  const baseColor = options.color     ?? [0.92, 0.91, 0.88];
  const veinColor = options.veinColor ?? [0.45, 0.45, 0.43];
  const WARP_PERIOD    = options.warpPeriod   ?? 8;
  const warpStrength   = options.warpStrength ?? 6.0;
  const normalStrength = options.normalStrength ?? 0.4;
  const roughness      = options.roughness      ?? 0.18;

  const color = newPixelBuffer(size);
  const cd = color.data;
  const hgt = newPixelBuffer(size);
  const hd = hgt.data;
  const wf = WARP_PERIOD / size;
  const TWO_PI = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const warp = periodicFbm(x * wf, y * wf, WARP_PERIOD, WARP_PERIOD, 4) * warpStrength;
      const v = Math.sin(x * TWO_PI * VEINS / size + warp);
      const vein = Math.exp(-v * v * 18.0);
      const r = baseColor[0] * (1 - vein) + veinColor[0] * vein;
      const g = baseColor[1] * (1 - vein) + veinColor[1] * vein;
      const b = baseColor[2] * (1 - vein) + veinColor[2] * vein;
      const i = (y * size + x) * 4;
      cd[i    ] = Math.round(clamp01(r) * 255);
      cd[i + 1] = Math.round(clamp01(g) * 255);
      cd[i + 2] = Math.round(clamp01(b) * 255);
      cd[i + 3] = 255;
      const h = Math.round((0.5 + vein * 0.05) * 255);
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
