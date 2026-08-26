/**
 * Painter for wood-plank PBR material.
 *
 * @module generation/paintMaterials/paintWoodPlank
 */

import type {MaterialMaps} from "./MaterialMaps";
import {
  clamp01,
  flatMR,
  hash2,
  heightToNormal,
  newPixelBuffer,
  paintMR,
  periodicFbm,
  periodicNoise2
} from "./utils";

/** Options accepted by {@link paintWoodPlank}. */
export interface PaintWoodPlankOptions {
  /**
   * Number of planks across the texture. Default `10`. Combined with
   * the painter caller's UV scale, this controls how narrow the
   * planks read at the rendered surface. More planks-per-texture
   * means less visible repetition across a tiled surface — at the
   * cost of finer planks at the same `uvScale`.
   */
  planks?: number;
  /** Plank-seam width, as a fraction of plank width. Default `0.015`. */
  seam?: number;
  /** Plank-edge bevel, as a fraction of plank width. Default `0.04`. */
  bevel?: number;
  /** Wood base colour. Default `[0.52, 0.38, 0.25]` (warm oak). */
  color?: [number, number, number];
  /** `heightToNormal` strength. Default `1.4`. */
  normalStrength?: number;
  /**
   * Roughness centre. The output `mr` modulates `+0..+0.12` above
   * this on grain peaks. Default `0.45`.
   */
  roughness?: number;
  /**
   * Number of growth-ring cycles along the plank's long axis.
   * Default `3`.
   */
  rings?: number;
}

/**
 * Fine wood-plank cladding. The texture is laid out as `planks`
 * full-height columns stacked along U; each column is one plank with
 * a dark seam left and right, a small bevelled edge, per-plank
 * colour jitter, and quartersawn-style grain rings warped by an fBm.
 * The plank's long axis runs along V.
 *
 * Orientation on rendered surfaces depends on how the surface's UVs
 * were generated. The planar projection used by
 * {@link studio!attachSceneModelMaterials | attachSceneModelMaterials}
 * aligns V with world vertical on wall-like geometries, so this
 * painter renders vertical planks on every wall. Non-metal.
 */
export function paintWoodPlank(size: number, options: PaintWoodPlankOptions = {}): MaterialMaps {
  const COLS = options.planks ?? 10;
  const cellW = size / COLS;
  const seamW = (options.seam ?? 0.015) * cellW;
  const bevelFrac = options.bevel ?? 0.04;
  const baseColor = options.color ?? [0.52, 0.38, 0.25];
  const normalStrength = options.normalStrength ?? 1.4;
  const roughness = options.roughness ?? 0.45;
  const RINGS = options.rings ?? 3;

  const TWO_PI = Math.PI * 2;
  // Warp + streak periods share the grain direction with paintOak —
  // grain runs along V, so warp varies fast in V (Py high) and
  // slowly across U (Px low), and streak noise varies fast in U
  // (Px high) and slowly down V (Py low). The latter produces the
  // along-grain colour streaks you see in real planed wood; flipping
  // these creates horizontal banding instead.
  const WARP_PX = 2, WARP_PY = 10;
  const STREAK_PX = 128, STREAK_PY = 10;

  // Per-plank phase for grain rings + per-plank colour jitter, looked
  // up by column index. Re-seeded per pixel via `hash2(col * k, 0)`.
  const ringWarpAt = (x: number, y: number) =>
    periodicFbm(x * WARP_PX / size, y * WARP_PY / size, WARP_PX, WARP_PY, 4) * 8.0;

  // grainAt: 1.0 on a ring crest, falling off quickly to 0 elsewhere.
  // Rings run along V (y in texture); the plank's long axis.
  const grainAt = (x: number, y: number, col: number) => {
    const phase = hash2(col * 17.13, 0) * TWO_PI;
    const ring = Math.sin(y * TWO_PI * RINGS / size + phase + ringWarpAt(x, y));
    return Math.exp(-ring * ring * 4.0);
  };

  // Heightfield: planks raised, seams sunken, soft edge bevel.
  const hgt = newPixelBuffer(size);
  const hd = hgt.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const col = Math.floor(x / cellW);
      const xInCell = x - col * cellW;
      const fx = Math.min(xInCell, cellW - xInCell) / cellW;
      const inSeam = xInCell < seamW || xInCell > cellW - seamW;
      let h: number;
      if (inSeam) {
        h = 0.20;
      } else {
        h = 0.65 + Math.min(1, fx / bevelFrac) * 0.35;
      }
      const i = (y * size + x) * 4;
      const v = Math.round(h * 255);
      hd[i] = hd[i + 1] = hd[i + 2] = v;
      hd[i + 3] = 255;
    }
  }

  // Colour map: per-plank tint, fBm-warped grain rings along V,
  // along-grain streak noise, dark seam.
  const color = newPixelBuffer(size);
  const cd = color.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const col = Math.floor(x / cellW);
      const xInCell = x - col * cellW;
      const inSeam = xInCell < seamW || xInCell > cellW - seamW;
      let r: number, g: number, b: number;
      if (inSeam) {
        const m = (hash2(x * 0.13, y * 0.17) - 0.5) * 0.05;
        r = baseColor[0] * 0.30 + m;
        g = baseColor[1] * 0.30 + m;
        b = baseColor[2] * 0.30 + m;
      } else {
        const id = hash2(col * 17.13, 0);
        const tint = 0.94 + id * 0.12;
        const grain = grainAt(x, y, col);
        // Per-plank streak offset — shift the noise lookup by a
        // hashed amount so each plank gets a unique streak pattern
        // instead of all planks sampling the same vertical slice.
        // The offset is integer-cell so the noise stays periodic.
        const streakOffset = Math.floor(hash2(col * 4.71, 0) * STREAK_PX);
        const streak = periodicNoise2(
          (x * STREAK_PX) / size + streakOffset,
          (y * STREAK_PY) / size,
          STREAK_PX,
          STREAK_PY
        ) * 0.08;
        const grainMod = 1 + grain * 0.10 + (streak - 0.04);
        r = baseColor[0] * tint * grainMod;
        g = baseColor[1] * tint * grainMod;
        b = baseColor[2] * tint * grainMod;
      }
      const i = (y * size + x) * 4;
      cd[i    ] = Math.round(clamp01(r) * 255);
      cd[i + 1] = Math.round(clamp01(g) * 255);
      cd[i + 2] = Math.round(clamp01(b) * 255);
      cd[i + 3] = 255;
    }
  }

  return {
    color,
    normal: heightToNormal(hgt, normalStrength),
    mr: paintMR(size, (x, y) => {
      const col = Math.floor(x / cellW);
      const xInCell = x - col * cellW;
      if (xInCell < seamW || xInCell > cellW - seamW) {
        return [clamp01(roughness + 0.25), 0.0];
      }
      return [clamp01(roughness + grainAt(x, y, col) * 0.12), 0.0];
    }),
    flatColor: baseColor,
  };
}
