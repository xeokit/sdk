/**
 * Painter for polished iron PBR material.
 *
 * @module generation/paintMaterials/paintIron
 */

import type {MaterialMaps} from "./MaterialMaps";
import {flatMR, flatNormal, solidColor} from "./utils";

/** Options accepted by {@link paintIron}. */
export interface PaintIronOptions {
  /** F0 colour. Default `[0.562, 0.565, 0.578]`. */
  color?: [number, number, number];
  /** Uniform roughness in `[0..1]`. Default `0.05`. */
  roughness?: number;
}

/**
 * Polished iron — a near-neutral grey mirror, distinguishable from
 * chrome by a faintly cooler F0 and slightly lower reflectance.
 * Default F0 ≈ `(0.562, 0.565, 0.578)`. Default roughness `0.05`.
 * Metallic 1.0.
 */
export function paintIron(size: number, options: PaintIronOptions = {}): MaterialMaps {
  const color = options.color ?? [0.562, 0.565, 0.578];
  const roughness = options.roughness ?? 0.05;
  return {
    color: solidColor(size, color),
    normal: flatNormal(size),
    mr: flatMR(size, roughness, 1.0),
    flatColor: color,
  };
}
