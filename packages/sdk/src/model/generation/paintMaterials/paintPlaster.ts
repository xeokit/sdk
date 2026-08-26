/**
 * Painter for off-white painted-plaster PBR material.
 *
 * @module generation/paintMaterials/paintPlaster
 */

import type {MaterialMaps} from "./MaterialMaps";
import {
  clamp01,
  flatMR,
  heightToNormal,
  newPixelBuffer,
  periodicFbm
} from "./utils";

/** Options accepted by {@link paintPlaster}. */
export interface PaintPlasterOptions {
  /** Period of the trowel-mark fBm in lattice cells. Default `8`. */
  noisePeriod?: number;
  /** Plaster base colour. Default `[0.94, 0.93, 0.91]`. */
  color?: [number, number, number];
  /** `heightToNormal` strength. Default `0.6`. */
  normalStrength?: number;
  /** Uniform roughness in `[0..1]`. Default `0.65`. */
  roughness?: number;
}

/**
 * Off-white painted plaster. fBm-driven low-amplitude trowel marks
 * provide colour and subtle relief. Non-metal.
 */
export function paintPlaster(size: number, options: PaintPlasterOptions = {}): MaterialMaps {
  const PERIOD = options.noisePeriod ?? 8;
  const baseColor = options.color    ?? [0.94, 0.93, 0.91];
  const normalStrength = options.normalStrength ?? 0.6;
  const roughness      = options.roughness      ?? 0.65;

  const color = newPixelBuffer(size);
  const cd = color.data;
  const hgt = newPixelBuffer(size);
  const hd = hgt.data;
  const f = PERIOD / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = periodicFbm(x * f, y * f, PERIOD, PERIOD, 5);
      const m = (n - 0.5) * 0.04 / 0.94;
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
