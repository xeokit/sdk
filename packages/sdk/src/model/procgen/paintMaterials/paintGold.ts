/**
 * Painter for gold PBR material.
 *
 * @module procgen/paintMaterials/paintGold
 */

import type {MaterialMaps} from "./MaterialMaps";
import {flatMR, flatNormal, solidColor} from "./utils";

/** Options accepted by {@link paintGold}. */
export interface PaintGoldOptions {
  /** F0 colour. Default `[1.000, 0.784, 0.341]` (standard sRGB gold). */
  color?: [number, number, number];
  /** Uniform roughness in `[0..1]`. Default `0.05`. */
  roughness?: number;
}

/**
 * Gold. Default F0 ≈ `(1.000, 0.784, 0.341)`, the standard sRGB
 * gold reference. Default roughness `0.05`. Metallic 1.0.
 */
export function paintGold(size: number, options: PaintGoldOptions = {}): MaterialMaps {
  const color = options.color ?? [1.000, 0.784, 0.341];
  const roughness = options.roughness ?? 0.05;
  return {
    color: solidColor(size, color),
    normal: flatNormal(size),
    mr: flatMR(size, roughness, 1.0),
    flatColor: color,
  };
}
