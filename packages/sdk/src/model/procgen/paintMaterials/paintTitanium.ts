/**
 * Painter for titanium PBR material.
 *
 * @module procgen/paintMaterials/paintTitanium
 */

import type {MaterialMaps} from "./MaterialMaps";
import {flatMR, flatNormal, solidColor} from "./utils";

/** Options accepted by {@link paintTitanium}. */
export interface PaintTitaniumOptions {
  /** F0 colour. Default `[0.542, 0.497, 0.449]`. */
  color?: [number, number, number];
  /** Uniform roughness in `[0..1]`. Default `0.10`. */
  roughness?: number;
}

/**
 * Titanium — slightly warm grey, less reflective than the noble
 * metals. Default F0 ≈ `(0.542, 0.497, 0.449)`. Default roughness
 * `0.10`. Metallic 1.0.
 */
export function paintTitanium(size: number, options: PaintTitaniumOptions = {}): MaterialMaps {
  const color = options.color ?? [0.542, 0.497, 0.449];
  const roughness = options.roughness ?? 0.10;
  return {
    color: solidColor(size, color),
    normal: flatNormal(size),
    mr: flatMR(size, roughness, 1.0)
  };
}
