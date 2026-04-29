/**
 * Painter for silver PBR material.
 *
 * @module procgen/paintMaterials/paintSilver
 */

import type {MaterialMaps} from "./MaterialMaps";
import {flatMR, flatNormal, solidColor} from "./utils";

/** Options accepted by {@link paintSilver}. */
export interface PaintSilverOptions {
  /** F0 colour. Default `[0.972, 0.960, 0.915]`. */
  color?: [number, number, number];
  /** Uniform roughness in `[0..1]`. Default `0.02`. */
  roughness?: number;
}

/**
 * Silver — the most reflective natural metal. Default F0 ≈
 * `(0.972, 0.960, 0.915)`. Default roughness `0.02`. Metallic 1.0.
 */
export function paintSilver(size: number, options: PaintSilverOptions = {}): MaterialMaps {
  const color = options.color ?? [0.972, 0.960, 0.915];
  const roughness = options.roughness ?? 0.02;
  return {
    color: solidColor(size, color),
    normal: flatNormal(size),
    mr: flatMR(size, roughness, 1.0)
  };
}
