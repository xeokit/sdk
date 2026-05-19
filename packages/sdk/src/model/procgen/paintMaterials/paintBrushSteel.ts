/**
 * Painter for brushed-steel PBR material.
 *
 * @module procgen/paintMaterials/paintBrushSteel
 */

import type {MaterialMaps} from "./MaterialMaps";
import {
  clamp01,
  heightToNormal,
  newPixelBuffer,
  paintMR,
  periodicNoise2
} from "./utils";

/** Options accepted by {@link paintBrushSteel}. */
export interface PaintBrushSteelOptions {
  /** Steel base colour. Default `[0.74, 0.74, 0.755]`. */
  color?: [number, number, number];
  /** `heightToNormal` strength. Default `1.0`. */
  normalStrength?: number;
  /**
   * Roughness centre. The output `mr` modulates `+0..+0.18` above
   * this on the bright stripes. Default `0.30`.
   */
  roughness?: number;
}

/**
 * Brushed steel. Anisotropic horizontal scratches are produced by
 * summing two periodic noise fields (one tight-spaced, one
 * broad-spaced) that drive colour, normal relief, and per-pixel
 * roughness. The anisotropy makes specular response direction-
 * dependent across the grain. Metallic 1.0.
 */
export function paintBrushSteel(size: number, options: PaintBrushSteelOptions = {}): MaterialMaps {
  const baseColor = options.color ?? [0.74, 0.74, 0.755];
  const normalStrength = options.normalStrength ?? 1.0;
  const roughness      = options.roughness      ?? 0.30;

  const color = newPixelBuffer(size);
  const cd = color.data;
  const hgt = newPixelBuffer(size);
  const hd = hgt.data;
  const FAST_PX = 128, FAST_PY = 8;
  const SLOW_PX = 32,  SLOW_PY = 4;
  const stripeAt = (x: number, y: number) =>
      periodicNoise2(x * FAST_PX / size, y * FAST_PY / size, FAST_PX, FAST_PY) * 0.5
    + periodicNoise2(x * SLOW_PX / size, y * SLOW_PY / size, SLOW_PX, SLOW_PY) * 0.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const stripe = stripeAt(x, y);
      const m = (stripe - 0.5) * 0.08 / 0.74;
      const i = (y * size + x) * 4;
      cd[i    ] = Math.round(clamp01(baseColor[0] * (1 + m)) * 255);
      cd[i + 1] = Math.round(clamp01(baseColor[1] * (1 + m)) * 255);
      cd[i + 2] = Math.round(clamp01(baseColor[2] * (1 + m)) * 255);
      cd[i + 3] = 255;
      const h = Math.round(stripe * 255);
      hd[i] = hd[i + 1] = hd[i + 2] = h;
      hd[i + 3] = 255;
    }
  }
  return {
    color,
    normal: heightToNormal(hgt, normalStrength),
    mr: paintMR(size, (x, y) => [clamp01(roughness + stripeAt(x, y) * 0.18), 1.0]),
    flatColor: baseColor,
  };
}
