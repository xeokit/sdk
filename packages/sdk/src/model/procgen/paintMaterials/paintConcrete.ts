/**
 * Painter for poured-concrete PBR material.
 *
 * @module procgen/paintMaterials/paintConcrete
 */

import type {MaterialMaps} from "./MaterialMaps";
import {
  clamp01,
  heightToNormal,
  newPixelBuffer,
  paintMR,
  periodicFbm,
  periodicHash2
} from "./utils";

/** Options accepted by {@link paintConcrete}. */
export interface PaintConcreteOptions {
  /** Period of the colour/heightfield fBm in lattice cells. Default `18`. */
  noisePeriod?: number;
  /** Base colour. Default `[0.62, 0.62, 0.614]`. */
  color?: [number, number, number];
  /** `heightToNormal` strength. Default `1.2`. */
  normalStrength?: number;
  /**
   * Roughness centre. The output `mr` modulates `±0.08` around this
   * via a half-period fBm. Default `0.86`.
   */
  roughness?: number;
}

/**
 * Cool grey poured concrete. Colour and heightfield are driven by
 * the same fBm; a per-pixel hash adds a low-amplitude dust speckle.
 * Roughness varies with a half-period fBm so light-scattering
 * variation is coherent with the colour map.
 */
export function paintConcrete(size: number, options: PaintConcreteOptions = {}): MaterialMaps {
  const PERIOD = options.noisePeriod   ?? 18;
  const baseColor = options.color      ?? [0.62, 0.62, 0.614];
  const normalStrength = options.normalStrength ?? 1.2;
  const roughness      = options.roughness      ?? 0.86;

  const hgt = newPixelBuffer(size);
  const color = newPixelBuffer(size);
  const hd = hgt.data;
  const cd = color.data;
  const f = PERIOD / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = periodicFbm(x * f, y * f, PERIOD, PERIOD, 4);
      const dust = periodicHash2(x, y, size, size);
      const m = (n - 0.5) * 0.18 - dust * 0.04;
      const i = (y * size + x) * 4;
      cd[i    ] = Math.round(clamp01(baseColor[0] + m) * 255);
      cd[i + 1] = Math.round(clamp01(baseColor[1] + m) * 255);
      cd[i + 2] = Math.round(clamp01(baseColor[2] + m) * 255);
      cd[i + 3] = 255;
      const h = Math.round(n * 255);
      hd[i] = hd[i + 1] = hd[i + 2] = h;
      hd[i + 3] = 255;
    }
  }
  return {
    color,
    normal: heightToNormal(hgt, normalStrength),
    mr: paintMR(size, (x, y) => {
      const n = periodicFbm(x * 12 / size, y * 12 / size, 12, 12, 3);
      return [clamp01(roughness + (n - 0.5) * 0.16), 0.0];
    }),
    flatColor: baseColor,
  };
}
