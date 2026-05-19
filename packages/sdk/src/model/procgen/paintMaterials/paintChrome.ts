/**
 * Painter for chrome PBR material.
 *
 * @module procgen/paintMaterials/paintChrome
 */

import type {MaterialMaps} from "./MaterialMaps";
import {flatMR, flatNormal, solidColor} from "./utils";

/** Options accepted by {@link paintChrome}. */
export interface PaintChromeOptions {
  /** F0 colour. Default `[0.910, 0.918, 0.933]`. */
  color?: [number, number, number];
  /** Uniform roughness in `[0..1]`. Default `0.03`. */
  roughness?: number;
}

/**
 * Chrome. Default F0 ≈ `(0.910, 0.918, 0.933)`. Default roughness
 * `0.03`. Metallic 1.0.
 */
export function paintChrome(size: number, options: PaintChromeOptions = {}): MaterialMaps {
  const color = options.color ?? [0.910, 0.918, 0.933];
  const roughness = options.roughness ?? 0.03;
  return {
    color: solidColor(size, color),
    normal: flatNormal(size),
    mr: flatMR(size, roughness, 1.0),
    flatColor: color,
  };
}
