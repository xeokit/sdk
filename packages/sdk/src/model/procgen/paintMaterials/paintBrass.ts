/**
 * Painter for brass PBR material.
 *
 * @module procgen/paintMaterials/paintBrass
 */

import type {MaterialMaps} from "./MaterialMaps";
import {flatMR, flatNormal, solidColor} from "./utils";

/** Options accepted by {@link paintBrass}. */
export interface PaintBrassOptions {
  /** F0 colour. Default `[0.898, 0.780, 0.451]` (warmer and less saturated than gold). */
  color?: [number, number, number];
  /** Uniform roughness in `[0..1]`. Default `0.18`. */
  roughness?: number;
}

/**
 * Brass. Default F0 ≈ `(0.898, 0.780, 0.451)`, warmer and less
 * saturated than gold. Default roughness `0.18`. Metallic 1.0.
 */
export function paintBrass(size: number, options: PaintBrassOptions = {}): MaterialMaps {
  const color = options.color ?? [0.898, 0.780, 0.451];
  const roughness = options.roughness ?? 0.18;
  return {
    color: solidColor(size, color),
    normal: flatNormal(size),
    mr: flatMR(size, roughness, 1.0)
  };
}
