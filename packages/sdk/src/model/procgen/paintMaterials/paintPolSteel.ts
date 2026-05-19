/**
 * Painter for polished-steel PBR material.
 *
 * @module procgen/paintMaterials/paintPolSteel
 */

import type {MaterialMaps} from "./MaterialMaps";
import {flatMR, flatNormal, solidColor} from "./utils";

/** Options accepted by {@link paintPolSteel}. */
export interface PaintPolSteelOptions {
  /** Steel base colour. Default `[0.816, 0.831, 0.855]`. */
  color?: [number, number, number];
  /** Uniform roughness in `[0..1]`. Default `0.08`. */
  roughness?: number;
}

/**
 * Polished steel. Uniform colour, flat normal, no surface
 * microstructure. Metallic 1.0.
 */
export function paintPolSteel(size: number, options: PaintPolSteelOptions = {}): MaterialMaps {
  const color = options.color ?? [0.816, 0.831, 0.855];
  const roughness = options.roughness ?? 0.08;
  return {
    color: solidColor(size, color),
    normal: flatNormal(size),
    mr: flatMR(size, roughness, 1.0),
    flatColor: color,
  };
}
