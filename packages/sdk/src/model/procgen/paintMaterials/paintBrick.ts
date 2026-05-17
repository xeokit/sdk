/**
 * Painter for running-bond brick PBR material.
 *
 * @module procgen/paintMaterials/paintBrick
 */

import type {MaterialMaps} from "./MaterialMaps";
import {
  clamp01,
  flatMR,
  hash2,
  heightToNormal,
  newPixelBuffer,
  periodicHash2
} from "./utils";

/** Options accepted by {@link paintBrick}. */
export interface PaintBrickOptions {
  /** Bricks across the texture's width. Default `6`. */
  cols?: number;
  /** Brick courses across the texture's height. Default `8`. */
  rows?: number;
  /** Mortar gap thickness, as a fraction of cell height. Default `0.07`. */
  mortar?: number;
  /** Brick edge bevel, as a fraction of cell width. Default `0.18`. */
  bevel?: number;
  /** Per-brick base colour in `[0..1]³`. Default `[0.55, 0.22, 0.18]`. */
  color?: [number, number, number];
  /** Mortar base colour in `[0..1]³`. Default `[0.45, 0.45, 0.43]`. */
  mortarColor?: [number, number, number];
  /** `heightToNormal` strength. Default `4.0`. */
  normalStrength?: number;
  /** Uniform roughness in `[0..1]`. Default `0.85`. */
  roughness?: number;
}

/**
 * Running-bond brick wall. A `cols × rows` lattice with row staggering,
 * mortar gaps, and per-brick colour jitter. The heightfield drives a
 * bevelled normal map. Non-metal.
 */
export function paintBrick(size: number, options: PaintBrickOptions = {}): MaterialMaps {
  const COLS  = options.cols  ?? 6;
  const ROWS  = options.rows  ?? 8;
  const cellW = size / COLS, cellH = size / ROWS;
  const mortar = (options.mortar ?? 0.07) * cellH;
  const bevel  = options.bevel ?? 0.18;
  const baseColor   = options.color       ?? [0.55, 0.22, 0.18];
  const mortarColor = options.mortarColor ?? [0.45, 0.45, 0.43];
  const normalStrength = options.normalStrength ?? 4.0;
  const roughness      = options.roughness      ?? 0.85;

  const hgt = newPixelBuffer(size);
  const hd = hgt.data;
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / cellH);
    const yInCell = y - row * cellH;
    const stagger = (row % 2) * (cellW * 0.5);
    for (let x = 0; x < size; x++) {
      const xs = (x + stagger) % size;
      const col = Math.floor(xs / cellW);
      const xInCell = xs - col * cellW;
      const fx = Math.min(xInCell, cellW - xInCell) / cellW;
      const fy = Math.min(yInCell, cellH - yInCell) / cellH;
      const inMortarX = xInCell < mortar || xInCell > cellW - mortar;
      const inMortarY = yInCell < mortar || yInCell > cellH - mortar;
      let h: number;
      if (inMortarX || inMortarY) {
        h = 0.05;
      } else {
        const e = Math.min(fx, fy);
        h = 0.55 + Math.min(1, e / bevel) * 0.45;
      }
      const i = (y * size + x) * 4;
      const v = Math.round(h * 255);
      hd[i] = hd[i + 1] = hd[i + 2] = v;
      hd[i + 3] = 255;
    }
  }

  const color = newPixelBuffer(size);
  const cd = color.data;
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / cellH);
    const yInCell = y - row * cellH;
    const stagger = (row % 2) * (cellW * 0.5);
    for (let x = 0; x < size; x++) {
      const xs = (x + stagger) % size;
      const col = Math.floor(xs / cellW);
      const xInCell = xs - col * cellW;
      const inMortarX = xInCell < mortar || xInCell > cellW - mortar;
      const inMortarY = yInCell < mortar || yInCell > cellH - mortar;
      let r: number, g: number, b: number;
      if (inMortarX || inMortarY) {
        const m = 0.05 * periodicHash2(x, y, size, size);
        r = mortarColor[0] + m;
        g = mortarColor[1] + m;
        b = mortarColor[2] + m * 0.95;
      } else {
        const id = hash2(col * 7.13, row * 3.71);
        const speckle = (periodicHash2(x, y, size, size) - 0.5) * 0.10;
        r = clamp01(baseColor[0] + 0.18 * id + speckle);
        g = clamp01(baseColor[1] + 0.10 * id + speckle * 0.5);
        b = clamp01(baseColor[2] + 0.08 * id + speckle * 0.3);
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
    mr: flatMR(size, roughness, 0.0)
  };
}
