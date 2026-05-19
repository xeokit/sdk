/**
 * Painter for asphalt PBR material.
 *
 * @module procgen/paintMaterials/paintAsphalt
 */

import type {MaterialMaps} from "./MaterialMaps";
import {
  clamp01,
  flatMR,
  heightToNormal,
  newPixelBuffer,
  periodicHash2
} from "./utils";

/** Options accepted by {@link paintAsphalt}. */
export interface PaintAsphaltOptions {
  /** Pebble cell size in pixels. Default `4`. */
  pebbleSize?: number;
  /** Base asphalt colour at zero pebble brightness. Default `[0.10, 0.10, 0.097]`. */
  color?: [number, number, number];
  /** Mineral-fleck colour. Default `[0.55, 0.55, 0.534]`. */
  fleckColor?: [number, number, number];
  /** Per-pixel-hash threshold above which a fleck is placed. Default `0.97`. */
  fleckThreshold?: number;
  /** `heightToNormal` strength. Default `3.0`. */
  normalStrength?: number;
  /** Uniform roughness in `[0..1]`. Default `0.95`. */
  roughness?: number;
}

/**
 * Asphalt. A pebble grid of `pebbleSize`-pixel cells drives both
 * colour darkness and normal relief. A per-pixel speckle adds
 * occasional bright flecks. Non-metal.
 */
export function paintAsphalt(size: number, options: PaintAsphaltOptions = {}): MaterialMaps {
  const PEBBLE_PX = options.pebbleSize ?? 4;
  const baseColor  = options.color      ?? [0.10, 0.10, 0.097];
  const fleckColor = options.fleckColor ?? [0.55, 0.55, 0.534];
  const fleckThreshold = options.fleckThreshold ?? 0.97;
  const normalStrength = options.normalStrength ?? 3.0;
  const roughness      = options.roughness      ?? 0.95;

  const color = newPixelBuffer(size);
  const cd = color.data;
  const hgt = newPixelBuffer(size);
  const hd = hgt.data;
  const PEBBLES = size / PEBBLE_PX;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const big = periodicHash2(Math.floor(x / PEBBLE_PX), Math.floor(y / PEBBLE_PX), PEBBLES, PEBBLES);
      const small = periodicHash2(x, y, size, size);
      const t = clamp01(big);   // pebble brightness in [0, 1]
      let r = baseColor[0] + t * baseColor[0];
      let g = baseColor[1] + t * baseColor[1];
      let b = baseColor[2] + t * baseColor[2];
      if (small > fleckThreshold) {
        r = fleckColor[0]; g = fleckColor[1]; b = fleckColor[2];
      }
      const i = (y * size + x) * 4;
      cd[i    ] = Math.round(clamp01(r) * 255);
      cd[i + 1] = Math.round(clamp01(g) * 255);
      cd[i + 2] = Math.round(clamp01(b) * 255);
      cd[i + 3] = 255;
      const h = Math.round((0.3 + big * 0.7) * 255);
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
