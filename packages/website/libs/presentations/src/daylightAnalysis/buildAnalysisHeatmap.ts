import type {DaylightAnalysisResult} from "./DaylightAnalysisResult";
import type {Scene, SceneModel} from "@xeokit/sdk/model/scene";
import {
  TrianglesPrimitive,
  NearestFilter,
  ClampToEdgeWrapping,
  LinearEncoding,
} from "@xeokit/sdk/base/constants";


/**
 * Options for {@link buildAnalysisHeatmap}.
 *
 * @module presentations/daylightAnalysis
 */
export interface BuildAnalysisHeatmapOptions {
  /** SceneModel id. Default `"daylightAnalysisHeatmap"`. */
  id?: string;

  /** Vertical offset above the grid's centre Z. Lifts the heatmap
   *  slightly off whatever surface it's sitting on to avoid Z-fight.
   *  Default `0.02` m. */
  zOffset?: number;

  /**
   * Min / max value range mapped to the colour gradient ends.
   * Default `[0, result.max]`. Pass a fixed `[0, maxHoursPerYear]`
   * to make multiple analyses directly comparable.
   */
  range?: [number, number];

  /**
   * RGB triples evenly spaced across `range`. The builder
   * interpolates between adjacent entries for each cell's value.
   * Default is a 5-stop deep-blue → cyan → yellow → orange → white
   * gradient.
   */
  gradient?: Array<[number, number, number]>;

  /**
   * Opacity for the heatmap quad. Default `0.85`.
   */
  opacity?: number;
}


// Default gradient, cool to warm.
const DEFAULT_GRADIENT: Array<[number, number, number]> = [
  [0.05, 0.07, 0.30],  // deep blue (no sun)
  [0.10, 0.45, 0.75],  // medium blue
  [0.95, 0.95, 0.30],  // yellow
  [0.95, 0.55, 0.15],  // orange
  [1.00, 1.00, 0.95],  // white-hot
];


/**
 * Build a {@link model!scene.SceneModel | SceneModel} that paints
 * a {@link DaylightAnalysisResult} as a single textured quad lying
 * on the work plane. The texture is an `nx × ny` RGBA image whose
 * texels carry the gradient-mapped sunlit-hour values; the quad
 * samples it with `NearestFilter` so each analysis cell renders
 * as a separate square.
 *
 * One SceneModel, one geometry, one material, one texture, one
 * mesh, one object. Total renderer cost is independent of grid
 * resolution. A 100×100 analysis costs the same to draw as a 10×10.
 *
 * For finer control (custom shading, baking into an existing
 * model's texture), read `result.values` directly.
 *
 * @module presentations/daylightAnalysis
 */
export function buildAnalysisHeatmap(
  scene: Scene,
  result: DaylightAnalysisResult,
  opts: BuildAnalysisHeatmapOptions = {},
): SceneModel | null {

  const id       = opts.id      ?? "daylightAnalysisHeatmap";
  const zOffset  = opts.zOffset ?? 0.02;
  const [rangeMin, rangeMax] = opts.range ?? [0, result.max];
  const gradient = opts.gradient ?? DEFAULT_GRADIENT;
  const opacity  = opts.opacity ?? 0.85;

  const [nx, ny] = result.grid.resolution;
  const [minX, minY, minZ] = result.grid.min;
  const [maxX, maxY, maxZ] = result.grid.max;
  const z = minZ + 0.5 * (maxZ - minZ) + zOffset;

  const modelResult = scene.createModel({ id });
  if (!modelResult.ok) {
    console.error("[buildAnalysisHeatmap] createModel failed:", modelResult);
    return null;
  }
  const model = modelResult.value;

  // ── Texture ────────────────────────────────────────────────────
  // One RGBA8 texel per analysis cell. Walking the values in row-
  // major order matches `result.values[iy * nx + ix]`.
  const pixels = new Uint8ClampedArray(nx * ny * 4);
  const span = Math.max(1e-6, rangeMax - rangeMin);
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const v = result.values[iy * nx + ix];
      const t = Math.max(0, Math.min(1, (v - rangeMin) / span));
      const c = sampleGradient(gradient, t);
      const o = (iy * nx + ix) * 4;
      pixels[o    ] = Math.round(c[0] * 255);
      pixels[o + 1] = Math.round(c[1] * 255);
      pixels[o + 2] = Math.round(c[2] * 255);
      pixels[o + 3] = 255;
    }
  }
  const texResult = model.createTexture({
    id:        `${id}_tex`,
    imageData: { data: pixels, width: nx, height: ny },
    magFilter: NearestFilter,
    minFilter: NearestFilter,
    wrapS:     ClampToEdgeWrapping,
    wrapT:     ClampToEdgeWrapping,
    encoding:  LinearEncoding,
    flipY:     false,
  });
  if (!texResult.ok) {
    console.error("[buildAnalysisHeatmap] createTexture failed:", texResult);
    model.destroy();
    return null;
  }

  // ── Material ───────────────────────────────────────────────────
  // White base colour so the texture's RGB passes through unmodulated.
  // Opacity here drives the alpha-blended overlay so the floor reads
  // through faintly.
  const matResult = model.createMaterial({
    id:             `${id}_mat`,
    color:          [1, 1, 1],
    opacity,
    roughness:      1.0,
    metallic:       0.0,
    colorTextureId: `${id}_tex`,
  });
  if (!matResult.ok) {
    console.error("[buildAnalysisHeatmap] createMaterial failed:", matResult);
    model.destroy();
    return null;
  }

  // ── Geometry: single quad covering the full grid extent ────────
  // UVs span (0,0) → (1,1). With NearestFilter + texels aligned to
  // cell centres, each cell renders as a crisp square.
  const positions = new Float32Array([
    minX, minY, z,
    maxX, minY, z,
    maxX, maxY, z,
    minX, maxY, z,
  ]);
  const normals = new Float32Array([
    0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
  ]);
  const uvs = new Float32Array([
    0, 0,
    1, 0,
    1, 1,
    0, 1,
  ]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
  const geomResult = model.createGeometry({
    id:        `${id}_geom`,
    primitive: TrianglesPrimitive,
    positions,
    normals,
    uvs,
    indices,
  });
  if (!geomResult.ok) {
    console.error("[buildAnalysisHeatmap] createGeometry failed:", geomResult);
    model.destroy();
    return null;
  }

  const meshResult = model.createMesh({
    id:         `${id}_mesh`,
    geometryId: `${id}_geom`,
    materialId: `${id}_mat`,
  });
  if (!meshResult.ok) {
    console.error("[buildAnalysisHeatmap] createMesh failed:", meshResult);
    model.destroy();
    return null;
  }

  const objResult = model.createObject({
    id:      id,
    meshIds: [`${id}_mesh`],
  });
  if (!objResult.ok) {
    console.error("[buildAnalysisHeatmap] createObject failed:", objResult);
    model.destroy();
    return null;
  }

  return model;
}


function sampleGradient(
  gradient: Array<[number, number, number]>,
  t: number,
): [number, number, number] {
  if (gradient.length === 0) return [0.5, 0.5, 0.5];
  if (gradient.length === 1) return gradient[0];
  if (t <= 0) return gradient[0];
  if (t >= 1) return gradient[gradient.length - 1];
  const segments = gradient.length - 1;
  const scaled   = t * segments;
  const i        = Math.floor(scaled);
  const f        = scaled - i;
  const a = gradient[i];
  const b = gradient[i + 1];
  return [
    a[0] * (1 - f) + b[0] * f,
    a[1] * (1 - f) + b[1] * f,
    a[2] * (1 - f) + b[2] * f,
  ];
}
