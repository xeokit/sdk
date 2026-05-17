/**
 * Painter for drafting / blueprint paper PBR material — a
 * near-white sheet with low-frequency tonal variation, a fine
 * fibre grain in the normal map, and a faint repeating grid
 * suggesting graph paper. Designed as a backdrop for vector
 * line work; reads as paper, not as a hard surface.
 *
 * @module procgen/paintMaterials/paintBlueprintPaper
 */

import type {MaterialMaps} from "./MaterialMaps";
import {
  clamp01,
  flatMR,
  heightToNormal,
  newPixelBuffer,
  periodicFbm,
  periodicNoise2,
} from "./utils";


/** Options accepted by {@link paintBlueprintPaper}. */
export interface PaintBlueprintPaperOptions {
  /**
   * Base paper colour in `[0..1]³`. Default `[0.96, 0.97, 0.99]`
   * — a very cool off-white.
   */
  color?: [number, number, number];
  /**
   * Tonal-variation strength — how much the macro fBm darkens
   * and lightens the base colour. Default `0.04` (subtle).
   */
  tonalStrength?: number;
  /**
   * Period of the soft macro fBm wash, in lattice cells across
   * the texture. Default `2`.
   */
  shadePeriod?: number;
  /**
   * Fibre-grain frequency — number of noise lattice cells across
   * the texture for the high-frequency normal-map detail.
   * Default `48`. Higher values produce finer grain.
   */
  fibreFrequency?: number;
  /**
   * Strength passed to {@link heightToNormal} when deriving the
   * normal map from the paper height field. Default `0.6` —
   * shallow enough that the relief shows up under grazing light
   * but doesn't read as fabric.
   */
  normalStrength?: number;
  /**
   * Repeat count of the faint graph-paper grid across the
   * texture. `0` disables the grid. Default `16`.
   */
  gridRepeats?: number;
  /**
   * Grid line strength — how much the grid darkens the base
   * colour where it lands. Default `0.06` (very faint).
   */
  gridStrength?: number;
  /**
   * Uniform roughness in `[0..1]`. Default `0.92` — paper is
   * close to fully diffuse.
   */
  roughness?: number;
}


/**
 * Drafting paper. Three signal layers composed:
 *
 *   - **Macro tonal wash** — slow periodic fBm tinting the base
 *     colour by ±`tonalStrength` so the sheet doesn't read as a
 *     flat solid.
 *   - **Faint graph-paper grid** — a thin line every
 *     `texture / gridRepeats` pixels along both axes, mixed in
 *     at `gridStrength` so it sits under the line work without
 *     fighting it.
 *   - **High-frequency fibres** — periodic value-noise written
 *     into a heightfield and run through {@link heightToNormal}.
 *
 * Output: opaque non-metal with high roughness.
 */
export function paintBlueprintPaper(
  size: number,
  options: PaintBlueprintPaperOptions = {},
): MaterialMaps {
  const baseColor      = options.color          ?? [0.96, 0.97, 0.99];
  const tonalStrength  = options.tonalStrength  ?? 0.04;
  const shadePeriod    = options.shadePeriod    ?? 2;
  const fibreFreq      = options.fibreFrequency ?? 48;
  const normalStrength = options.normalStrength ?? 0.6;
  const gridRepeats    = options.gridRepeats    ?? 16;
  const gridStrength   = options.gridStrength   ?? 0.06;
  const roughness      = options.roughness      ?? 0.92;

  const color = newPixelBuffer(size);
  const cd = color.data;
  const hgt = newPixelBuffer(size);
  const hd = hgt.data;

  const sf = shadePeriod / size;
  const ff = fibreFreq   / size;
  // Pre-derive grid pixel period and the soft-edge half-width
  // either side of the line centre, so the grid renders as a
  // ~1-pixel band rather than a single hard texel.
  const gridPeriod = gridRepeats > 0 ? size / gridRepeats : 0;
  const gridHalf   = 0.8;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {

      // Macro tonal wash — ±tonalStrength around 0.
      const macro = periodicFbm(x * sf, y * sf, shadePeriod, shadePeriod, 4);
      const tone  = (macro - 0.5) * 2 * tonalStrength;

      // Faint graph-paper grid. Distance to the nearest grid
      // line in each axis, smooth-stepped into a 0..1 mask, then
      // taken to the OR-equivalent (1 - (1-gx)(1-gy)) so the
      // axes don't double-darken at intersections.
      let gridMask = 0;
      if (gridPeriod > 0) {
        const dx = Math.abs((x % gridPeriod) - gridPeriod * 0.5);
        const dy = Math.abs((y % gridPeriod) - gridPeriod * 0.5);
        const ax = clamp01((gridPeriod * 0.5 - dx - gridHalf) / 0.6);
        const ay = clamp01((gridPeriod * 0.5 - dy - gridHalf) / 0.6);
        gridMask = 1 - (1 - ax) * (1 - ay);
      }
      const gridTint = gridMask * gridStrength;

      // Final colour = base + tonal wash − grid tint.
      const r = clamp01(baseColor[0] + tone - gridTint);
      const g = clamp01(baseColor[1] + tone - gridTint);
      const b = clamp01(baseColor[2] + tone - gridTint);

      const i = (y * size + x) * 4;
      cd[i    ] = Math.round(r * 255);
      cd[i + 1] = Math.round(g * 255);
      cd[i + 2] = Math.round(b * 255);
      cd[i + 3] = 255;

      // Heightfield — high-frequency periodic value noise to
      // capture paper fibres. The macro wash also contributes a
      // small amount so very-low frequency creases show up as
      // gentle warps under grazing light.
      const fibre = periodicNoise2(x * ff, y * ff, fibreFreq, fibreFreq);
      const h = 0.55 + 0.4 * fibre + 0.05 * (macro - 0.5);
      const v = Math.round(clamp01(h) * 255);
      hd[i    ] = v;
      hd[i + 1] = v;
      hd[i + 2] = v;
      hd[i + 3] = 255;
    }
  }

  return {
    color,
    normal: heightToNormal(hgt, normalStrength),
    mr:     flatMR(size, roughness, 0.0),
  };
}
