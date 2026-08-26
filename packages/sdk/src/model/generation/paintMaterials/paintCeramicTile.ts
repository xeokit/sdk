/**
 * Painter for glazed ceramic tile PBR material.
 *
 * @module generation/paintMaterials/paintCeramicTile
 */

import type {MaterialMaps} from "./MaterialMaps";
import {
  clamp01,
  hash2,
  heightToNormal,
  newPixelBuffer,
  paintMR,
  periodicHash2
} from "./utils";

/** Options accepted by {@link paintCeramicTile}. */
export interface PaintCeramicTileOptions {
  /** Tiles across the texture's width. Default `8`. */
  cols?: number;
  /** Tiles across the texture's height. Default `8`. */
  rows?: number;
  /** Grout gap thickness, as a fraction of cell size. Default `0.04`. */
  grout?: number;
  /** Tile edge bevel, as a fraction of cell size. Default `0.06`. */
  bevel?: number;
  /** Tile base colour. Default `[0.92, 0.90, 0.86]` (cream). */
  color?: [number, number, number];
  /** Grout colour. Default `[0.45, 0.45, 0.43]` (mid grey). */
  groutColor?: [number, number, number];
  /** `heightToNormal` strength. Default `3.0`. */
  normalStrength?: number;
  /** Roughness on the tile surface. Default `0.18` (glazed). */
  tileRoughness?: number;
  /** Roughness on the grout. Default `0.85` (matte cement). */
  groutRoughness?: number;
}

/**
 * Glazed ceramic floor / wall tile. A `cols × rows` grid with thin
 * grout gaps and a small bevel at each tile edge. The metallic-
 * roughness map varies across the surface — tiles are glossy, grout
 * is matte — so IBL specular reflects sharply on the tile body and
 * diffuses across the grout. Per-tile colour jitter keeps the array
 * from reading as flat plastic; per-pixel speckle adds a fine glaze
 * imperfection. Non-metal.
 */
export function paintCeramicTile(size: number, options: PaintCeramicTileOptions = {}): MaterialMaps {
  const COLS = options.cols ?? 8;
  const ROWS = options.rows ?? 8;
  const cellW = size / COLS;
  const cellH = size / ROWS;
  const groutW = (options.grout ?? 0.04) * cellW;
  const groutH = (options.grout ?? 0.04) * cellH;
  const bevelFrac = options.bevel ?? 0.06;
  const baseColor      = options.color           ?? [0.92, 0.90, 0.86];
  const groutColor     = options.groutColor      ?? [0.45, 0.45, 0.43];
  const normalStrength = options.normalStrength  ?? 3.0;
  const tileRoughness  = options.tileRoughness   ?? 0.18;
  const groutRoughness = options.groutRoughness  ?? 0.85;

  // Heightfield: tiles raised, grout sunken, gentle bevel at edges.
  const hgt = newPixelBuffer(size);
  const hd = hgt.data;
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / cellH);
    const yInCell = y - row * cellH;
    for (let x = 0; x < size; x++) {
      const col = Math.floor(x / cellW);
      const xInCell = x - col * cellW;
      const fx = Math.min(xInCell, cellW - xInCell) / cellW;
      const fy = Math.min(yInCell, cellH - yInCell) / cellH;
      const inGroutX = xInCell < groutW || xInCell > cellW - groutW;
      const inGroutY = yInCell < groutH || yInCell > cellH - groutH;
      let h: number;
      if (inGroutX || inGroutY) {
        h = 0.05;
      } else {
        const e = Math.min(fx, fy);
        h = 0.65 + Math.min(1, e / bevelFrac) * 0.35;
      }
      const i = (y * size + x) * 4;
      const v = Math.round(h * 255);
      hd[i] = hd[i + 1] = hd[i + 2] = v;
      hd[i + 3] = 255;
    }
  }

  // Colour map: per-tile jitter + per-pixel speckle on tile body,
  // hashed darkening on grout.
  const color = newPixelBuffer(size);
  const cd = color.data;
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / cellH);
    const yInCell = y - row * cellH;
    for (let x = 0; x < size; x++) {
      const col = Math.floor(x / cellW);
      const xInCell = x - col * cellW;
      const inGroutX = xInCell < groutW || xInCell > cellW - groutW;
      const inGroutY = yInCell < groutH || yInCell > cellH - groutH;
      let r: number, g: number, b: number;
      if (inGroutX || inGroutY) {
        const m = (periodicHash2(x, y, size, size) - 0.5) * 0.04;
        r = clamp01(groutColor[0] + m);
        g = clamp01(groutColor[1] + m);
        b = clamp01(groutColor[2] + m);
      } else {
        const id = hash2(col * 7.13, row * 3.71);
        const tint = 1 + (id - 0.5) * 0.08;
        const speckle = (periodicHash2(x, y, size, size) - 0.5) * 0.03;
        r = clamp01(baseColor[0] * tint + speckle);
        g = clamp01(baseColor[1] * tint + speckle);
        b = clamp01(baseColor[2] * tint + speckle);
      }
      const i = (y * size + x) * 4;
      cd[i    ] = Math.round(r * 255);
      cd[i + 1] = Math.round(g * 255);
      cd[i + 2] = Math.round(b * 255);
      cd[i + 3] = 255;
    }
  }

  return {
    color,
    normal: heightToNormal(hgt, normalStrength),
    mr: paintMR(size, (x, y) => {
      const col = Math.floor(x / cellW);
      const row = Math.floor(y / cellH);
      const xInCell = x - col * cellW;
      const yInCell = y - row * cellH;
      const inGroutX = xInCell < groutW || xInCell > cellW - groutW;
      const inGroutY = yInCell < groutH || yInCell > cellH - groutH;
      const r = (inGroutX || inGroutY) ? groutRoughness : tileRoughness;
      return [r, 0.0];
    }),
    flatColor: baseColor,
  };
}
