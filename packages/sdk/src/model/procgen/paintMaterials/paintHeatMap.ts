/**
 * Painter for a geometry-tailored heat-map PBR material.
 *
 * Unlike the tileable painters in this directory, `paintHeatMap` is
 * geometry-aware: it rasterises a per-vertex scalar field into a
 * texture sized to a single geometry, and emits the per-vertex UVs
 * the geometry needs to display the result. The pair (texture + UVs)
 * is therefore a one-shot binding; the texture has no meaning when
 * applied to any other geometry.
 *
 * @module procgen/paintMaterials/paintHeatMap
 */

import type {AABB3} from "../../../base/math/boundaries";
import type {IntArrayParam} from "../../../base/math";
import type {MaterialMaps} from "./MaterialMaps";
import {clamp01, flatMR, flatNormal, newPixelBuffer} from "./utils";

/** A single colour stop in a heat-map ramp. */
export interface HeatMapStop {
  /** Normalised position along the ramp, in `[0, 1]`. */
  position: number;
  /** sRGB colour at this stop, components in `[0, 1]`. */
  color: [number, number, number];
}

/**
 * Default cool→hot ramp (blue → cyan → green → yellow → red). Roughly
 * jet-flavoured; perceptually OK for engineering visualisations even if
 * not as flat-luminance as viridis.
 */
export const DEFAULT_HEATMAP_RAMP: ReadonlyArray<HeatMapStop> = [
  {position: 0.00, color: [0.05, 0.05, 0.45]},
  {position: 0.25, color: [0.10, 0.55, 0.95]},
  {position: 0.50, color: [0.20, 0.85, 0.30]},
  {position: 0.75, color: [0.95, 0.85, 0.10]},
  {position: 1.00, color: [0.95, 0.15, 0.10]},
];

/** Geometry input consumed by {@link paintHeatMap}. */
export interface PaintHeatMapGeometry {
  /** Quantised vertex positions (Uint16, range `[0, 65535]` within `aabb`). */
  positionsCompressed: IntArrayParam;
  /** Triangle indices. Length must be a multiple of 3. */
  indices: IntArrayParam;
  /** AABB the compressed positions decompress against. */
  aabb: AABB3;
  /** Per-vertex scalar field. Length must equal `positionsCompressed.length / 3`. */
  scalars: ArrayLike<number>;
  /**
   * Optional pre-baked per-vertex UVs in `[0, 1]²` — `2 × vertexCount`
   * floats. When supplied, the painter uses these instead of running
   * its planar projection from positions. Useful for axis-aligned
   * shapes (boxes, cylinders aligned with worldUp) whose faces would
   * collapse to lines under planar projection — supply a per-face
   * unwrap (cube-map style) and every face gets its own non-
   * degenerate UV rectangle.
   */
  uvs?: ArrayLike<number>;
}

/** Options accepted by {@link paintHeatMap}. */
export interface PaintHeatMapOptions {
  /** Square texture size in pixels. Default `256`. */
  size?: number;
  /**
   * Colour ramp sampled left→right as the scalar value goes from
   * `range[0]`→`range[1]`. Stops do not have to be evenly spaced.
   * Default {@link DEFAULT_HEATMAP_RAMP}.
   */
  ramp?: ReadonlyArray<HeatMapStop>;
  /**
   * Scalar value range mapped onto the ramp's `[0, 1]` domain. When
   * omitted, the range is auto-computed from the input scalars.
   */
  range?: [number, number];
  /**
   * World-up axis. Used to align the planar UV projection so a
   * "wall-like" geometry's V axis runs vertically — same heuristic
   * `attachSceneModelMaterials` uses, kept consistent for free
   * interchange with that path.
   */
  worldUp?: ArrayLike<number>;
  /** Constant roughness written into the metallic-roughness map. Default `0.6`. */
  roughness?: number;
  /** Constant metallic written into the metallic-roughness map. Default `0`. */
  metallic?: number;
  /**
   * RGB fill for texture pixels not covered by any triangle (the gaps
   * between projected triangles in UV space). Default `[0, 0, 0]`.
   */
  backgroundColor?: [number, number, number];
  /**
   * Optional grid overlay drawn on painted pixels (background pixels
   * are left alone). Useful for inspecting how the planar projection
   * laid the geometry's UVs into texture space. Pass `true` for the
   * defaults, an options object for control, or `false`/omit to skip.
   */
  grid?: boolean | HeatMapGridOptions;
}

/** Options for the optional debug grid drawn over painted heat maps. */
export interface HeatMapGridOptions {
  /**
   * Pixels between adjacent grid lines. Defaults to ≈ `size / 16`,
   * which gives a roughly 16-cell grid across the texture.
   */
  spacing?: number;
  /** sRGB grid line colour, components in `[0, 1]`. Default `[0, 0, 0]`. */
  color?: [number, number, number];
  /** Blend factor; `1` = fully opaque, `0` = invisible. Default `0.4`. */
  opacity?: number;
  /** Line width in pixels. Default `1`. */
  width?: number;
}

/** Result of {@link paintHeatMap}. */
export interface PaintHeatMapResult {
  /** Heat-map texture set: ramp-coloured `color`, flat `normal`, constant `mr`. */
  maps: MaterialMaps;
  /**
   * Per-vertex UVs matching the projection used to paint the colour
   * map. Length is `2 × vertexCount`. Values lie in `[0, 1]`,
   * mapping to the painted texture exactly once across the
   * geometry's AABB on the picked projection axes. Stored as
   * `Float32Array` so it slots straight into
   * `SceneGeometry.uvsCompressed` (which the renderer reads as raw
   * floats and `fract()`s per-fragment for tiling).
   */
  uvs: Float32Array;
  /** Effective scalar range used for normalisation. */
  range: [number, number];
}

/**
 * Paints a heat-map texture by rasterising a per-vertex scalar field
 * into UV space.
 *
 * Pipeline:
 *
 *   1. **Project.** Pick two of the AABB's three axes for the UV plane.
 *      With `worldUp` supplied and the geometry not flat in that axis,
 *      V is aligned with up; otherwise the smallest-extent axis is
 *      dropped (same heuristic as `attachSceneModelMaterials`).
 *   2. **Map.** Each vertex's compressed position becomes a UV in
 *      `[0, 1]²` directly — the AABB-normalised position on the picked
 *      axes. No tiling; the texture covers the projection exactly once.
 *   3. **Rasterise.** For each triangle, scan-convert in pixel space and
 *      barycentric-interpolate the vertex scalars. The interpolated
 *      scalar is normalised to `[0, 1]` against the active range and
 *      sampled through the colour ramp.
 *   4. **Compose.** Pair the colour map with `flatNormal` (no
 *      heightfield — the field carries its own variation) and a
 *      constant `mr` from the supplied roughness/metallic. Diffuse
 *      heat-map colour reads cleanly under the standard PBR shading.
 *
 * The returned `uvs` field is the only set that will display the
 * heat-map correctly; reusing the texture with a different UV layout
 * is meaningless.
 *
 * Triangles whose UV projection collapses to a line (zero area in the
 * picked plane — e.g. a wall's edge-on triangles when the wall is
 * thin in the dropped axis) are skipped. Pixels not covered by any
 * triangle keep `backgroundColor`.
 */
export function paintHeatMap(
  geometry: PaintHeatMapGeometry,
  options: PaintHeatMapOptions = {}
): PaintHeatMapResult {
  const size      = Math.max(1, Math.floor(options.size ?? 256));
  const ramp      = sortedRamp(options.ramp ?? DEFAULT_HEATMAP_RAMP);
  const roughness = clamp01(options.roughness ?? 0.6);
  const metallic  = clamp01(options.metallic  ?? 0.0);
  const bg        = options.backgroundColor   ?? [0, 0, 0];

  const positions = geometry.positionsCompressed;
  const indices   = geometry.indices;
  const scalars   = geometry.scalars;
  const aabb      = geometry.aabb;

  const vertCount = (positions.length / 3) | 0;
  const triCount  = (indices.length / 3) | 0;

  if (vertCount === 0 || triCount === 0) {
    return emptyResult(size, roughness, metallic, bg);
  }

  // ── 1. Scalar range ──────────────────────────────────────────────
  let sMin: number, sMax: number;
  if (options.range) {
    sMin = options.range[0];
    sMax = options.range[1];
  } else {
    sMin = Number.POSITIVE_INFINITY;
    sMax = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < vertCount; i++) {
      const v = scalars[i];
      if (v < sMin) sMin = v;
      if (v > sMax) sMax = v;
    }
  }
  if (!isFinite(sMin) || !isFinite(sMax)) {
    sMin = 0;
    sMax = 1;
  }
  const sSpan    = sMax - sMin;
  const invSpan  = sSpan !== 0 ? 1 / sSpan : 0;

  // ── 2. UV-axis selection (matches attachSceneModelMaterials) ────
  const exts: [number, number, number] = [
    aabb[3] - aabb[0],
    aabb[4] - aabb[1],
    aabb[5] - aabb[2],
  ];
  let smallestAxis = 0;
  if (exts[1] < exts[smallestAxis]) smallestAxis = 1;
  if (exts[2] < exts[smallestAxis]) smallestAxis = 2;

  let upAxis = -1;
  if (options.worldUp) {
    const ax = Math.abs(options.worldUp[0]);
    const ay = Math.abs(options.worldUp[1]);
    const az = Math.abs(options.worldUp[2]);
    if (ax >= ay && ax >= az)      upAxis = 0;
    else if (ay >= az)              upAxis = 1;
    else                            upAxis = 2;
  }

  let axisU: number, axisV: number;
  if (upAxis >= 0 && upAxis !== smallestAxis) {
    axisV = upAxis;
    const o0 = (upAxis + 1) % 3;
    const o1 = (upAxis + 2) % 3;
    axisU = exts[o0] >= exts[o1] ? o0 : o1;
  } else {
    axisU = (smallestAxis + 1) % 3;
    axisV = (smallestAxis + 2) % 3;
  }

  // ── 3. Per-vertex UVs in [0, 1] ──────────────────────────────────
  // Either copy the caller's pre-baked UVs (e.g. a cube-map unwrap
  // for an axis-aligned box, where planar projection would collapse
  // 4 of 6 faces) or generate planar UVs from positions: compressed
  // positions are AABB-normalised, so dividing by 65535 gives a UV
  // directly in [0, 1] on the picked axes.
  //
  // Either way we end up with a single Float32Array that both the
  // rasteriser below and the geometry's UV slot reference (returned
  // as `result.uvs`).
  const uvs = new Float32Array(vertCount * 2);
  if (geometry.uvs && geometry.uvs.length >= vertCount * 2) {
    for (let i = 0; i < vertCount * 2; i++) uvs[i] = geometry.uvs[i];
  } else {
    for (let i = 0; i < vertCount; i++) {
      uvs[i * 2]     = positions[i * 3 + axisU] / 65535;
      uvs[i * 2 + 1] = positions[i * 3 + axisV] / 65535;
    }
  }

  // ── 4. Allocate colour map and rasterise into it ─────────────
  const color = newPixelBuffer(size);
  rasterizeHeatMapColor(
    color.data,
    size,
    uvs,
    indices,
    scalars,
    sMin, invSpan,
    ramp,
    bg,
    options.grid,
    /*scratch*/ undefined,
  );

  return {
    maps: {
      color,
      normal: flatNormal(size),
      mr:     flatMR(size, roughness, metallic),
    },
    uvs,
    range: [sMin, sMax],
  };
}


/** Parameters for {@link repaintHeatMapColor}. */
export interface RepaintHeatMapColorParams {
  /** Triangle indices (length divisible by 3). */
  indices: IntArrayParam;
  /**
   * Per-vertex UVs in `[0, 1]²`, length `2 × vertexCount`. Same shape
   * `paintHeatMap` emits — typically copied straight from
   * `SceneGeometry.uvsCompressed` after the initial paint.
   */
  uvs: ArrayLike<number>;
  /** Per-vertex scalar field, length = vertexCount. */
  scalars: ArrayLike<number>;
  /**
   * Output buffer to repaint. Mutated in place; alpha is restored to
   * 255 on every pixel. Width / height define the texture size.
   */
  imageData: ImageData;
}

/** Options accepted by {@link repaintHeatMapColor}. */
export interface RepaintHeatMapColorOptions {
  /** Colour ramp. Default {@link DEFAULT_HEATMAP_RAMP}. */
  ramp?: ReadonlyArray<HeatMapStop>;
  /**
   * Scalar value range mapped onto the ramp's `[0, 1]` domain. Auto-
   * computed from the input scalars when omitted.
   */
  range?: [number, number];
  /**
   * RGB fill for pixels not covered by any triangle. Default
   * `[0, 0, 0]`.
   */
  backgroundColor?: [number, number, number];
  /** Optional grid overlay; same shape as on `paintHeatMap`. */
  grid?: boolean | HeatMapGridOptions;
  /**
   * Reusable coverage scratch (`Uint8Array` of length ≥
   * `width × height`). Allocated internally if absent — pre-allocate
   * and reuse across calls when repainting many heat maps per frame
   * (live solar / sensor sweeps) to keep GC quiet.
   */
  coveredScratch?: Uint8Array;
}

/**
 * Re-rasterise a heat-map colour texture from a new scalar field,
 * mutating the supplied {@link ImageData} in place.
 *
 * This is the slim sibling of {@link paintHeatMap}, intended for live
 * updates: the geometry's UVs already exist (the initial
 * `paintHeatMap` call wrote them onto `SceneGeometry.uvsCompressed`),
 * the SceneTexture's pixel buffer already exists, and the normal /
 * MR maps don't change between frames. So this function skips
 * UV-axis selection, UV emission, and normal/MR allocation —
 * everything left is rasterise + dilate + blur(×2) + optional grid,
 * straight into the caller's buffer.
 *
 * Pair with `texture.imageData = imageData` to fire the
 * `onSceneTextureImageDataChanged` event, which makes the renderer
 * re-upload just the affected atlas sub-rect via `texSubImage2D` —
 * no batch / mesh / material rebuild.
 */
export function repaintHeatMapColor(
  params: RepaintHeatMapColorParams,
  options: RepaintHeatMapColorOptions = {}
): void {
  const indices   = params.indices;
  const uvs       = params.uvs;
  const scalars   = params.scalars;
  const imageData = params.imageData;
  const w = imageData.width;
  const h = imageData.height;
  if (w !== h) {
    // The painters produce square textures; the rasteriser below
    // assumes width === height. Caller bug if this trips.
    throw new Error(`[repaintHeatMapColor] imageData must be square (got ${w}×${h})`);
  }

  const ramp = sortedRamp(options.ramp ?? DEFAULT_HEATMAP_RAMP);
  const bg   = options.backgroundColor ?? [0, 0, 0];

  let sMin: number, sMax: number;
  if (options.range) {
    sMin = options.range[0];
    sMax = options.range[1];
  } else {
    sMin = Number.POSITIVE_INFINITY;
    sMax = Number.NEGATIVE_INFINITY;
    const n = (uvs.length / 2) | 0;
    for (let i = 0; i < n; i++) {
      const v = scalars[i];
      if (v < sMin) sMin = v;
      if (v > sMax) sMax = v;
    }
  }
  if (!isFinite(sMin) || !isFinite(sMax)) { sMin = 0; sMax = 1; }
  const sSpan   = sMax - sMin;
  const invSpan = sSpan !== 0 ? 1 / sSpan : 0;

  rasterizeHeatMapColor(
    imageData.data,
    w,
    uvs,
    indices,
    scalars,
    sMin, invSpan,
    ramp,
    bg,
    options.grid,
    options.coveredScratch,
  );
}


/**
 * Workhorse called by both {@link paintHeatMap} and
 * {@link repaintHeatMapColor}. Pre-fills `cd` with `bg`, scan-converts
 * each triangle (pixel-centre sampling, top-left fill convention with
 * a small edge tolerance), dilates the painted region one pixel into
 * background, applies two 3×3 box-blur passes (the renderer has no
 * mipmaps, so we pre-filter the texture against minification moiré),
 * and finally splats the optional debug grid.
 *
 * `coveredScratch` lets callers re-use a `Uint8Array` of length ≥
 * `size × size` across many calls to keep allocation rate low for
 * per-frame use — the function fills it from zero on entry.
 *
 * @internal
 */
function rasterizeHeatMapColor(
  cd: Uint8ClampedArray,
  size: number,
  uvs: ArrayLike<number>,
  indices: IntArrayParam,
  scalars: ArrayLike<number>,
  sMin: number,
  invSpan: number,
  ramp: ReadonlyArray<HeatMapStop>,
  bg: [number, number, number],
  grid: boolean | HeatMapGridOptions | undefined,
  coveredScratch: Uint8Array | undefined,
): void {
  const triCount = (indices.length / 3) | 0;

  const bgR = Math.round(clamp01(bg[0]) * 255);
  const bgG = Math.round(clamp01(bg[1]) * 255);
  const bgB = Math.round(clamp01(bg[2]) * 255);
  for (let i = 0; i < cd.length; i += 4) {
    cd[i]     = bgR;
    cd[i + 1] = bgG;
    cd[i + 2] = bgB;
    cd[i + 3] = 255;
  }

  const cells = size * size;
  let covered: Uint8Array;
  if (coveredScratch && coveredScratch.length >= cells) {
    covered = coveredScratch;
    // Only zero the prefix we'll touch — the caller may have
    // over-allocated the scratch for the largest texture in a batch.
    for (let i = 0; i < cells; i++) covered[i] = 0;
  } else {
    covered = new Uint8Array(cells);
  }

  const last = size - 1;
  const EDGE_EPS = 1e-5;
  for (let t = 0; t < triCount; t++) {
    const i0 = indices[t * 3];
    const i1 = indices[t * 3 + 1];
    const i2 = indices[t * 3 + 2];

    const u0 = uvs[i0 * 2]     * last, v0 = uvs[i0 * 2 + 1] * last;
    const u1 = uvs[i1 * 2]     * last, v1 = uvs[i1 * 2 + 1] * last;
    const u2 = uvs[i2 * 2]     * last, v2 = uvs[i2 * 2 + 1] * last;

    const denom = (v1 - v2) * (u0 - u2) + (u2 - u1) * (v0 - v2);
    if (Math.abs(denom) < 1e-10) continue;
    const invDenom = 1 / denom;

    const s0 = (scalars[i0] - sMin) * invSpan;
    const s1 = (scalars[i1] - sMin) * invSpan;
    const s2 = (scalars[i2] - sMin) * invSpan;

    const minU = Math.max(0, Math.floor(Math.min(u0, u1, u2)));
    const maxU = Math.min(last, Math.ceil(Math.max(u0, u1, u2)));
    const minV = Math.max(0, Math.floor(Math.min(v0, v1, v2)));
    const maxV = Math.min(last, Math.ceil(Math.max(v0, v1, v2)));

    for (let py = minV; py <= maxV; py++) {
      const sy = py + 0.5;
      for (let px = minU; px <= maxU; px++) {
        const sx = px + 0.5;
        const w0 = ((v1 - v2) * (sx - u2) + (u2 - u1) * (sy - v2)) * invDenom;
        const w1 = ((v2 - v0) * (sx - u2) + (u0 - u2) * (sy - v2)) * invDenom;
        const w2 = 1 - w0 - w1;
        if (w0 < -EDGE_EPS || w1 < -EDGE_EPS || w2 < -EDGE_EPS) continue;

        const s = clamp01(w0 * s0 + w1 * s1 + w2 * s2);
        const rgb = sampleRamp(ramp, s);
        const i = (py * size + px) * 4;
        cd[i]     = Math.round(rgb[0] * 255);
        cd[i + 1] = Math.round(rgb[1] * 255);
        cd[i + 2] = Math.round(rgb[2] * 255);
        cd[i + 3] = 255;
        covered[py * size + px] = 1;
      }
    }
  }

  dilateOnce(cd, covered, size);
  boxBlurPainted(cd, covered, size);
  boxBlurPainted(cd, covered, size);

  if (grid) {
    const g = grid === true ? {} : grid;
    drawGrid(cd, covered, size, {
      spacing: Math.max(1, Math.floor(g.spacing ?? Math.max(8, size / 16))),
      color:   g.color   ?? [0, 0, 0],
      opacity: clamp01(g.opacity ?? 0.4),
      width:   Math.max(1, Math.floor(g.width   ?? 1)),
    });
  }
}


/**
 * One-step morphological dilation of the painted region. Each
 * background pixel that has at least one painted 4-neighbour adopts
 * the average of its painted neighbours; the coverage mask is
 * updated so a subsequent blur or sample sees the dilated region as
 * "painted." Cheap and visually sufficient for sealing UV-island
 * borders.
 */
function dilateOnce(
  cd: Uint8ClampedArray,
  covered: Uint8Array,
  size: number
): void {
  // Snapshot of the coverage mask — the loop must not see pixels it
  // wrote in this same pass, otherwise the dilation would cascade
  // into multi-pixel growth.
  const src = covered.slice();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const k = y * size + x;
      if (src[k]) continue;

      let r = 0, g = 0, b = 0, n = 0;
      if (x > 0          && src[k - 1])    { const j = k * 4 - 4;   r += cd[j]; g += cd[j+1]; b += cd[j+2]; n++; }
      if (x < size - 1   && src[k + 1])    { const j = k * 4 + 4;   r += cd[j]; g += cd[j+1]; b += cd[j+2]; n++; }
      if (y > 0          && src[k - size]) { const j = (k - size) * 4; r += cd[j]; g += cd[j+1]; b += cd[j+2]; n++; }
      if (y < size - 1   && src[k + size]) { const j = (k + size) * 4; r += cd[j]; g += cd[j+1]; b += cd[j+2]; n++; }

      if (n > 0) {
        const i = k * 4;
        cd[i]     = (r / n) | 0;
        cd[i + 1] = (g / n) | 0;
        cd[i + 2] = (b / n) | 0;
        covered[k] = 1;
      }
    }
  }
}

/**
 * 3×3 box blur over painted pixels only. Background pixels are
 * preserved verbatim. Shared-edge floating-point round-off creates
 * 1-px colour discontinuities along internal triangle boundaries —
 * one blur pass softens those into single-pixel ramps that no longer
 * alias under minification, which is what the moiré-prone
 * no-mipmaps texture path needs.
 */
function boxBlurPainted(
  cd: Uint8ClampedArray,
  covered: Uint8Array,
  size: number
): void {
  const src = new Uint8ClampedArray(cd);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const k = y * size + x;
      if (!covered[k]) continue;

      let r = 0, g = 0, b = 0, n = 0;
      const x0 = Math.max(0, x - 1), x1 = Math.min(size - 1, x + 1);
      const y0 = Math.max(0, y - 1), y1 = Math.min(size - 1, y + 1);
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          // Skip background neighbours so the blur doesn't pull in
          // the outside-island colour and dilute the heat-map edge.
          if (!covered[yy * size + xx]) continue;
          const j = (yy * size + xx) * 4;
          r += src[j]; g += src[j + 1]; b += src[j + 2];
          n++;
        }
      }
      if (n > 0) {
        const i = k * 4;
        cd[i]     = (r / n) | 0;
        cd[i + 1] = (g / n) | 0;
        cd[i + 2] = (b / n) | 0;
      }
    }
  }
}


/**
 * Linear-interpolates a colour from the ramp at normalised position
 * `t ∈ [0, 1]`. Stops outside `[t]` clamp; stops between are blended
 * pairwise. The ramp is assumed pre-sorted by `position` (the public
 * entry point sorts defensively).
 */
function sampleRamp(
  ramp: ReadonlyArray<HeatMapStop>,
  t: number
): [number, number, number] {
  if (t <= ramp[0].position) return ramp[0].color;
  const last = ramp.length - 1;
  if (t >= ramp[last].position) return ramp[last].color;
  for (let i = 1; i <= last; i++) {
    if (t <= ramp[i].position) {
      const a = ramp[i - 1];
      const b = ramp[i];
      const span = b.position - a.position;
      const f = span > 0 ? (t - a.position) / span : 0;
      return [
        a.color[0] + (b.color[0] - a.color[0]) * f,
        a.color[1] + (b.color[1] - a.color[1]) * f,
        a.color[2] + (b.color[2] - a.color[2]) * f,
      ];
    }
  }
  return ramp[last].color;
}

/**
 * Blend a grid overlay onto painted pixels. Background pixels are
 * skipped — the grid only marks the visible heat-mapped region. Lines
 * are drawn at every `spacing` pixels along each axis with a width of
 * `width` pixels; the grid colour is alpha-blended over the existing
 * pixel colour at the configured opacity.
 *
 * Drawn after the smoothing passes so the lines stay 1-pixel sharp;
 * the renderer's lack of mipmaps means at heavy minification the grid
 * will alias, but for inspection at native scales it reads cleanly.
 */
function drawGrid(
  cd: Uint8ClampedArray,
  covered: Uint8Array,
  size: number,
  opts: {
    spacing: number;
    color: [number, number, number];
    opacity: number;
    width: number;
  }
): void {
  const {spacing, color, opacity, width} = opts;
  const gR = Math.round(clamp01(color[0]) * 255);
  const gG = Math.round(clamp01(color[1]) * 255);
  const gB = Math.round(clamp01(color[2]) * 255);
  const a = opacity;
  const oneMinusA = 1 - a;
  for (let y = 0; y < size; y++) {
    const onHLine = (y % spacing) < width;
    for (let x = 0; x < size; x++) {
      const k = y * size + x;
      if (!covered[k]) continue;
      const onVLine = (x % spacing) < width;
      if (!onHLine && !onVLine) continue;
      const i = k * 4;
      cd[i]     = (cd[i]     * oneMinusA + gR * a) | 0;
      cd[i + 1] = (cd[i + 1] * oneMinusA + gG * a) | 0;
      cd[i + 2] = (cd[i + 2] * oneMinusA + gB * a) | 0;
    }
  }
}

function sortedRamp(ramp: ReadonlyArray<HeatMapStop>): ReadonlyArray<HeatMapStop> {
  return [...ramp].sort((a, b) => a.position - b.position);
}

function emptyResult(
  size: number,
  roughness: number,
  metallic: number,
  bg: [number, number, number]
): PaintHeatMapResult {
  const color = newPixelBuffer(size);
  const cd = color.data;
  const bgR = Math.round(clamp01(bg[0]) * 255);
  const bgG = Math.round(clamp01(bg[1]) * 255);
  const bgB = Math.round(clamp01(bg[2]) * 255);
  for (let i = 0; i < cd.length; i += 4) {
    cd[i]     = bgR;
    cd[i + 1] = bgG;
    cd[i + 2] = bgB;
    cd[i + 3] = 255;
  }
  return {
    maps: {
      color,
      normal: flatNormal(size),
      mr:     flatMR(size, roughness, metallic),
    },
    uvs: new Float32Array(0),
    range: [0, 1],
  };
}
