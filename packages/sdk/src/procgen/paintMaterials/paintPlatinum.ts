/**
 * Painter for platinum PBR material.
 *
 * @module procgen/paintMaterials/paintPlatinum
 */

import type {MaterialMaps} from "./MaterialMaps";
import {flatMR, flatNormal, solidColor} from "./utils";

/** Options accepted by {@link paintPlatinum}. */
export interface PaintPlatinumOptions {
  /** F0 colour. Default `[0.679, 0.642, 0.588]`. */
  color?: [number, number, number];
  /** Uniform roughness in `[0..1]`. Default `0.05`. */
  roughness?: number;
}

/**
 * Platinum. Cool, slightly darker than silver. Default F0 ≈
 * `(0.679, 0.642, 0.588)`. Default roughness `0.05`. Metallic 1.0.
 */
export function paintPlatinum(size: number, options: PaintPlatinumOptions = {}): MaterialMaps {
  const color = options.color ?? [0.679, 0.642, 0.588];
  const roughness = options.roughness ?? 0.05;
  return {
    color: solidColor(size, color),
    normal: flatNormal(size),
    mr: flatMR(size, roughness, 1.0)
  };
}
