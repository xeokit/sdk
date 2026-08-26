/**
 * Painter for aluminium PBR material.
 *
 * @module generation/paintMaterials/paintAluminium
 */

import type {MaterialMaps} from "./MaterialMaps";
import {flatMR, flatNormal, solidColor} from "./utils";

/** Options accepted by {@link paintAluminium}. */
export interface PaintAluminiumOptions {
  /** F0 colour. Default `[0.910, 0.922, 0.929]` (marginally cool of neutral). */
  color?: [number, number, number];
  /** Uniform roughness in `[0..1]`. Default `0.10`. */
  roughness?: number;
}

/**
 * Aluminium. Default F0 ≈ `(0.910, 0.922, 0.929)`, marginally cool
 * of neutral. Default roughness `0.10`. Metallic 1.0.
 */
export function paintAluminium(size: number, options: PaintAluminiumOptions = {}): MaterialMaps {
  const color = options.color ?? [0.910, 0.922, 0.929];
  const roughness = options.roughness ?? 0.10;
  return {
    color: solidColor(size, color),
    normal: flatNormal(size),
    mr: flatMR(size, roughness, 1.0),
    flatColor: color,
  };
}
