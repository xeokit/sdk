/**
 * Painter for quartersawn-oak PBR material.
 *
 * @module procgen/paintMaterials/paintOak
 */

import type {MaterialMaps} from "./MaterialMaps";
import {
  clamp01,
  heightToNormal,
  newPixelBuffer,
  paintMR,
  periodicFbm,
  periodicNoise2
} from "./utils";

/** Options accepted by {@link paintOak}. */
export interface PaintOakOptions {
  /** Number of growth-ring cycles down the texture. Default `7`. */
  rings?: number;
  /**
   * Number of base-tint sine cycles down the texture. Independent of
   * `rings`; gives a low-frequency warm/cool variation. Default `5`.
   */
  baseWave?: number;
  /** Wood base colour. Default `[0.462, 0.328, 0.210]`. */
  color?: [number, number, number];
  /** `heightToNormal` strength. Default `1.8`. */
  normalStrength?: number;
  /**
   * Roughness centre. The output `mr` modulates `+0..+0.18` above
   * this on grain peaks. Default `0.55`.
   */
  roughness?: number;
}

/**
 * Quartersawn oak. Concentric sine rings are warped by a periodic
 * fBm in the X axis. A separate streak noise modulates the colour
 * along the grain. Roughness varies with grain intensity, so peaks
 * scatter more than valleys. Non-metal.
 */
export function paintOak(size: number, options: PaintOakOptions = {}): MaterialMaps {
  const RINGS = options.rings ?? 7;
  const BASE_WAVE = options.baseWave ?? 5;
  const baseColor = options.color ?? [0.462, 0.328, 0.210];
  const normalStrength = options.normalStrength ?? 1.8;
  const roughness      = options.roughness      ?? 0.55;

  const color = newPixelBuffer(size);
  const cd = color.data;
  const hgt = newPixelBuffer(size);
  const hd = hgt.data;
  const TWO_PI = Math.PI * 2;
  const WARP_PX = 2, WARP_PY = 10;
  const STREAK_PX = 128, STREAK_PY = 10;
  const ringWarpAt = (x: number, y: number) =>
    periodicFbm(x * WARP_PX / size, y * WARP_PY / size, WARP_PX, WARP_PY, 4) * 12.0;
  const grainAt = (x: number, y: number) => {
    const ring = Math.sin(y * TWO_PI * RINGS / size + ringWarpAt(x, y));
    return Math.exp(-ring * ring * 4.0);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const grain = grainAt(x, y);
      const streak = periodicNoise2(x * STREAK_PX / size, y * STREAK_PY / size, STREAK_PX, STREAK_PY) * 0.15;
      const baseMod = 1 + 0.143 * Math.sin(y * TWO_PI * BASE_WAVE / size);
      const tint = baseMod + (grain * 0.12 + streak) / 0.42;
      const r = clamp01(baseColor[0] * tint);
      const g = clamp01(baseColor[1] * tint);
      const b = clamp01(baseColor[2] * tint);
      const i = (y * size + x) * 4;
      cd[i    ] = Math.round(r * 255);
      cd[i + 1] = Math.round(g * 255);
      cd[i + 2] = Math.round(b * 255);
      cd[i + 3] = 255;
      const h = Math.round((0.5 + grain * 0.5) * 255);
      hd[i] = hd[i + 1] = hd[i + 2] = h;
      hd[i + 3] = 255;
    }
  }
  return {
    color,
    normal: heightToNormal(hgt, normalStrength),
    mr: paintMR(size, (x, y) => [clamp01(roughness + grainAt(x, y) * 0.18), 0.0]),
    flatColor: baseColor,
  };
}
