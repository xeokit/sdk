// Custom procedural painter for an ashlar-coursed stone-block wall.
//
// Same shape as the SDK painters in
// `packages/sdk/src/model/procgen/paintMaterials/` — takes a square
// texture size, returns a `MaterialMaps` triple (`color`, `normal`,
// `mr`) plus a `flatColor` fallback. The painter is fully
// procedural; nothing is fetched and nothing is cached, so two
// instantiations with identical params produce identical maps.
//
// Differences from `paintBrick`:
//   - Larger blocks (3 cols × 5 rows by default; brick is 6 × 8).
//   - Wider mortar joints, with mortar slightly recessed and noise-
//     speckled rather than flat.
//   - Multi-octave fBm grain inside each block to read as quarried
//     stone rather than a flat brick.
//   - Per-block tint hash so adjacent blocks read as different
//     pieces cut from the same quarry batch.
//   - Higher roughness (0.90) and lower normal strength (3.5) than
//     brick — stones polish smoother than fired brick at distance.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const {
  newPixelBuffer,
  heightToNormal,
  flatMR,
  periodicHash2,
  periodicNoise2,
  periodicFbm,
  clamp01,
} = xeokit.model.procgen.paintMaterials;


/**
 * Paint an ashlar-coursed stone-block PBR material.
 *
 * @param {number} size              Square texture edge (typically 256–1024).
 * @param {object} [options]
 * @param {number} [options.cols=3]  Blocks across the texture width.
 * @param {number} [options.rows=5]  Block courses across the height.
 * @param {number} [options.mortar=0.10]  Mortar gap as a fraction of cell height.
 * @param {number} [options.bevel=0.22]   Block edge bevel as a fraction of cell width.
 * @param {[number, number, number]} [options.color=[0.62, 0.60, 0.55]]  Base stone colour.
 * @param {[number, number, number]} [options.mortarColor=[0.30, 0.30, 0.28]]  Mortar colour.
 * @param {number} [options.normalStrength=3.5]  Bevel relief strength.
 * @param {number} [options.roughness=0.90]      Constant roughness for the MR map.
 * @param {number} [options.blockNoise=0.08]     Per-pixel jitter amplitude.
 * @returns {{ color: object, normal: object, mr: object, flatColor: [number, number, number] }}
 */
export function paintStoneBlock(size, options = {}) {
  const COLS = options.cols  ?? 3;
  const ROWS = options.rows  ?? 5;
  const cellW = size / COLS, cellH = size / ROWS;
  const mortar = (options.mortar ?? 0.10) * cellH;
  const bevel  = options.bevel  ?? 0.22;
  const baseColor   = options.color       ?? [0.62, 0.60, 0.55];
  const mortarColor = options.mortarColor ?? [0.30, 0.30, 0.28];
  const normalStrength = options.normalStrength ?? 3.5;
  const roughness      = options.roughness      ?? 0.90;
  const blockNoise     = options.blockNoise     ?? 0.08;

  // Heightfield. Block interior beveled with low-frequency surface
  // noise so each face reads as quarried stone, not a flat tile.
  // Mortar joints are recessed and speckled rather than uniformly
  // flat to give the joint line some texture even when out of view.
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
      let h;
      if (inMortarX || inMortarY) {
        h = 0.10 + 0.05 * periodicHash2(x, y, size, size);
      } else {
        const e = Math.min(fx, fy);
        // Low-frequency block-surface noise — visible at grazing
        // angles after normal-from-height conversion.
        const bump = (periodicNoise2(x * 0.08, y * 0.08, size * 0.08, size * 0.08) - 0.5) * 0.12;
        h = clamp01(0.55 + Math.min(1, e / bevel) * 0.40 + bump);
      }
      const i = (y * size + x) * 4;
      const v = Math.round(h * 255);
      hd[i] = hd[i + 1] = hd[i + 2] = v;
      hd[i + 3] = 255;
    }
  }

  // Albedo. Three layered contributions per block: a per-block tint
  // hash (so neighbours look like different stones cut from the same
  // quarry), an fBm grain (the texture INSIDE each stone), and a
  // small per-pixel speckle (sub-surface noise).
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
      let r, g, b;
      if (inMortarX || inMortarY) {
        const m = 0.04 * periodicHash2(x, y, size, size);
        r = mortarColor[0] + m;
        g = mortarColor[1] + m;
        b = mortarColor[2] + m;
      } else {
        const id    = periodicHash2(col, row, COLS, ROWS) - 0.5;
        const grain = periodicFbm(x * 0.05, y * 0.05, size * 0.05, size * 0.05, 4) - 0.5;
        const spec  = (periodicHash2(x, y, size, size) - 0.5) * blockNoise;
        r = clamp01(baseColor[0] + 0.10 * id + 0.12 * grain + spec);
        g = clamp01(baseColor[1] + 0.08 * id + 0.12 * grain + spec);
        b = clamp01(baseColor[2] + 0.06 * id + 0.10 * grain + spec);
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
    mr:     flatMR(size, roughness, 0.0),
    flatColor: baseColor,
  };
}
