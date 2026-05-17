/**
 * Painter for glass-style transparent materials.
 *
 * @module procgen/paintMaterials/paintGlass
 */

import type {MaterialMaps} from "./MaterialMaps";
import {clamp01, flatMR, flatNormal, newPixelBuffer} from "./utils";


/** Options accepted by {@link paintGlass}. */
export interface PaintGlassOptions {
  /** Body tint colour. Default `[0.855, 0.910, 0.922]`. */
  color?: [number, number, number];
  /** Uniform roughness in `[0..1]`. Default `0.04`. */
  roughness?: number;
}

/**
 * Pale blue-green tinted glass. The albedo carries only the body
 * tint; the BRDF's Fresnel response (driven by `roughness` and
 * `metallic = 0.0`) supplies the reflective component.
 *
 * Pair with `SceneMaterial.alphaMode = "BLEND"` and an opacity in
 * the range 0.30–0.40 to render as a tinted window.
 */
export function paintGlass(size: number, options: PaintGlassOptions = {}): MaterialMaps {
  const baseColor = options.color ?? [0.855, 0.910, 0.922];
  const roughness = options.roughness ?? 0.04;

  const color = newPixelBuffer(size);
  const d = color.data;
  const r = Math.round(clamp01(baseColor[0]) * 255);
  const g = Math.round(clamp01(baseColor[1]) * 255);
  const b = Math.round(clamp01(baseColor[2]) * 255);
  for (let i = 0, n = d.length; i < n; i += 4) {
    d[i    ] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = 255;
  }
  return {
    color,
    normal: flatNormal(size),
    mr: flatMR(size, roughness, 0.0)
  };
}
