import type {VectorGrid} from "./VectorGrid";
import {sampleVectorGrid, vectorGridMagnitudeRange} from "./VectorGrid";
import {
  COLORMAP_VIRIDIS,
  sampleColormap,
  type ColormapStops,
} from "./colormaps";
import type {Scene, SceneModel} from "../../model/scene";
import {LinesPrimitive} from "../../base/constants";
import type {SDKResult} from "../../base/core";


/**
 * Options for {@link buildVolumeStreamlines}.
 *
 * @module presentations/volumeOverlay
 */
export interface BuildVolumeStreamlinesOptions {

  /** SceneModel id. Default `"volumeStreamlines"`. */
  id?: string;

  /**
   * Seeds are laid out in a `seedDensity³`-ish regular lattice
   * inside the volume bbox. Default `6` → about 216 streamlines,
   * which fits comfortably inside the WebGL line-batch limit at
   * typical step counts. Crank up for finer coverage at the cost
   * of mesh size.
   */
  seedDensity?: number;

  /**
   * Per-streamline integration step in world units. Default =
   * half of the smallest voxel spacing — keeps streamlines smooth
   * through tight features without aliasing. Smaller is finer +
   * costlier.
   */
  stepSize?: number;

  /**
   * Max integration steps per streamline. Caps both compute and
   * resulting mesh size — a few hundred steps usually covers the
   * volume in either direction. Default `200`.
   */
  maxSteps?: number;

  /**
   * Speed below which the integrator gives up — flows below
   * this magnitude are too slow to read as motion. Default `1e-4`
   * (in whatever units the field carries).
   */
  minSpeed?: number;

  /**
   * Integrate forward AND backward from each seed (the seed sits
   * roughly mid-streamline). Default `true` — gives more uniform
   * coverage of upstream / downstream sides.
   */
  bidirectional?: boolean;

  /**
   * Colormap used when colouring by speed. Default `viridis`.
   */
  colormap?: ColormapStops;

  /**
   * Magnitude range mapped to the colormap. Default
   * `grid.magnitudeRange` or the data-driven min/max.
   */
  range?: [number, number];

  /**
   * Colour mode for the lines:
   *
   *   - `"speed"` — per-vertex colour from {@link colormap} at the
   *     normalised local speed. The classic CFD streamline look.
   *   - `"uniform"` — all lines a single solid colour (passed via
   *     {@link uniformColor}). Faster, more legible in dense fields.
   *
   * Default `"speed"`.
   */
  colorMode?: "speed" | "uniform";

  /** Solid colour used when `colorMode === "uniform"`. Default `[0.10, 0.50, 0.90]`. */
  uniformColor?: [number, number, number];

  /**
   * Pixel thickness of the streamline polylines. Forwarded to the
   * renderer's thick-line draw technique via a per-mesh
   * {@link SceneMaterial.lineWidth} override. Default `2` — visible
   * but not so chunky it occludes adjacent streamlines.
   *
   * Set to `0` to fall back to the View's default
   * `linesMaterial.lineWidth`.
   */
  lineWidth?: number;
}


/**
 * Trace a single streamline through `grid` starting at the seed
 * point, using 4th-order Runge-Kutta with **unit-speed**
 * integration (velocity normalised at each sub-step). Unit-speed
 * keeps streamlines a similar length whether they're in fast or
 * slow regions, which reads better as a static visual — the local
 * speed is preserved per-vertex for the colour mapping.
 *
 * Returns a flat `Float32Array` of `[x0, y0, z0, speed0, x1, y1, z1, speed1, …]`
 * — 4 floats per vertex, the speed used for colour-by-magnitude.
 * Empty array means the seed point lies outside the field or
 * stalled immediately. Pure helper; never errors.
 */
export function traceStreamline(
  grid: VectorGrid,
  seedX: number, seedY: number, seedZ: number,
  opts: BuildVolumeStreamlinesOptions = {},
): Float32Array {

  const [nx, ny, nz] = grid.resolution;
  const [minX, minY, minZ] = grid.min;
  const [maxX, maxY, maxZ] = grid.max;

  const minSpacing = Math.min(
    (maxX - minX) / Math.max(1, nx - 1),
    (maxY - minY) / Math.max(1, ny - 1),
    (maxZ - minZ) / Math.max(1, nz - 1),
  );
  const stepSize = opts.stepSize ?? (minSpacing / 2);
  const maxSteps = opts.maxSteps ?? 200;
  const minSpeed = opts.minSpeed ?? 1e-4;
  const bidirectional = opts.bidirectional !== false;

  const k1: [number, number, number] = [0, 0, 0];
  const k2: [number, number, number] = [0, 0, 0];
  const k3: [number, number, number] = [0, 0, 0];
  const k4: [number, number, number] = [0, 0, 0];
  const probe: [number, number, number] = [0, 0, 0];

  const integrate = (sign: 1 | -1, into: number[]): void => {
    let x = seedX, y = seedY, z = seedZ;
    for (let s = 0; s < maxSteps; s++) {
      if (!sampleVectorGrid(grid, x, y, z, k1)) return;
      const m1 = Math.hypot(k1[0], k1[1], k1[2]);
      if (m1 < minSpeed) return;
      const nx1 = k1[0] / m1, ny1 = k1[1] / m1, nz1 = k1[2] / m1;

      sampleVectorGrid(grid, x + sign * 0.5 * stepSize * nx1,
                                y + sign * 0.5 * stepSize * ny1,
                                z + sign * 0.5 * stepSize * nz1, k2);
      const m2 = Math.hypot(k2[0], k2[1], k2[2]) || 1;
      const nx2 = k2[0] / m2, ny2 = k2[1] / m2, nz2 = k2[2] / m2;

      sampleVectorGrid(grid, x + sign * 0.5 * stepSize * nx2,
                                y + sign * 0.5 * stepSize * ny2,
                                z + sign * 0.5 * stepSize * nz2, k3);
      const m3 = Math.hypot(k3[0], k3[1], k3[2]) || 1;
      const nx3 = k3[0] / m3, ny3 = k3[1] / m3, nz3 = k3[2] / m3;

      sampleVectorGrid(grid, x + sign * stepSize * nx3,
                                y + sign * stepSize * ny3,
                                z + sign * stepSize * nz3, k4);
      const m4 = Math.hypot(k4[0], k4[1], k4[2]) || 1;
      const nx4 = k4[0] / m4, ny4 = k4[1] / m4, nz4 = k4[2] / m4;

      const dx = (nx1 + 2 * nx2 + 2 * nx3 + nx4) / 6;
      const dy = (ny1 + 2 * ny2 + 2 * ny3 + ny4) / 6;
      const dz = (nz1 + 2 * nz2 + 2 * nz3 + nz4) / 6;
      x += sign * stepSize * dx;
      y += sign * stepSize * dy;
      z += sign * stepSize * dz;

      const valid = sampleVectorGrid(grid, x, y, z, probe);
      if (!valid) return;
      const speed = Math.hypot(probe[0], probe[1], probe[2]);
      into.push(x, y, z, speed);
    }
  };

  const forward:  number[] = [];
  const backward: number[] = [];
  integrate(+1, forward);
  if (bidirectional) integrate(-1, backward);

  if (forward.length === 0 && backward.length === 0) return new Float32Array(0);

  sampleVectorGrid(grid, seedX, seedY, seedZ, probe);
  const seedSpeed = Math.hypot(probe[0], probe[1], probe[2]);

  const out: number[] = [];
  for (let i = backward.length - 4; i >= 0; i -= 4) {
    out.push(backward[i], backward[i + 1], backward[i + 2], backward[i + 3]);
  }
  out.push(seedX, seedY, seedZ, seedSpeed);
  for (let i = 0; i < forward.length; i += 4) {
    out.push(forward[i], forward[i + 1], forward[i + 2], forward[i + 3]);
  }
  return new Float32Array(out);
}


/**
 * Bake streamlines through `grid` into a SceneModel as
 * `LinesPrimitive` geometry. Seeds laid out in a regular lattice
 * inside the volume bbox; each seed integrates forward and
 * backward (when `bidirectional`, default true) into a single
 * polyline; all polylines combine into one mesh.
 *
 * Per-vertex colour (when `colorMode === "speed"`) is encoded as
 * a `colors` attribute on the geometry, so the colour gradient
 * along each line follows the local flow speed — fast regions
 * read brighter, stagnant regions fade.
 *
 * Returns `{ok: true, value: null}` when every seed stalled — an
 * empty streamline set is a legitimate "this flow has no traceable
 * structure" outcome, not an error. SceneModel create-call
 * failures propagate as `ok: false`.
 *
 * @module presentations/volumeOverlay
 */
export function buildVolumeStreamlines(
  scene: Scene,
  grid: VectorGrid,
  opts: BuildVolumeStreamlinesOptions = {},
): SDKResult<SceneModel | null> {

  const id           = opts.id           ?? "volumeStreamlines";
  const seedDensity  = Math.max(2, Math.round(opts.seedDensity ?? 6));
  const colormap     = opts.colormap     ?? COLORMAP_VIRIDIS;
  const colorMode    = opts.colorMode    ?? "speed";
  const uniformColor = opts.uniformColor ?? [0.10, 0.50, 0.90];
  const lineWidth    = opts.lineWidth    ?? 2;
  const [rangeMin, rangeMax] = opts.range
    ?? grid.magnitudeRange
    ?? vectorGridMagnitudeRange(grid);

  const [minX, minY, minZ] = grid.min;
  const [maxX, maxY, maxZ] = grid.max;
  const span = Math.max(1e-6, rangeMax - rangeMin);

  // GPU batch limits force us to split very dense streamline sets
  // into multiple line-primitive meshes within the same SceneModel.
  const MAX_VERTS_PER_MESH = 28000;

  const modelResult = scene.createModel({id});
  if (modelResult.ok !== true) {
    return {ok: false, error: `[buildVolumeStreamlines] createModel: ${modelResult.error}`, type: modelResult.type};
  }
  const model = modelResult.value;

  let lineMaterialId: string | undefined;
  if (lineWidth > 0) {
    const matRes = model.createMaterial({
      id:        `${id}_lineMat`,
      lineWidth,
      color:     [1, 1, 1],
    });
    if (matRes.ok !== true) {
      model.destroy();
      return {ok: false, error: `[buildVolumeStreamlines] createMaterial: ${matRes.error}`, type: matRes.type};
    }
    lineMaterialId = `${id}_lineMat`;
  }

  let chunkPositions: number[] = [];
  let chunkColors:    number[] = [];
  let chunkIndices:   number[] = [];
  let chunkVertexBase = 0;
  let chunkIndex = 0;
  const meshIds: string[] = [];

  // `flushChunk` returns SDKResult-style status so the outer loop
  // can propagate failures without throwing.
  const flushChunk = (): SDKResult<void> => {
    if (chunkIndices.length === 0) return {ok: true, value: undefined};
    const chunkId = `${id}_chunk${chunkIndex}`;
    const gRes = model.createGeometry({
      id:        `${chunkId}_geom`,
      primitive: LinesPrimitive,
      positions: new Float32Array(chunkPositions),
      colors:    new Float32Array(chunkColors),
      indices:   new Uint32Array(chunkIndices),
    });
    if (gRes.ok !== true) {
      return {ok: false, error: `[buildVolumeStreamlines] createGeometry: ${gRes.error}`, type: gRes.type};
    }
    const mRes = model.createMesh({
      id:         `${chunkId}_mesh`,
      geometryId: `${chunkId}_geom`,
      ...(lineMaterialId ? {materialId: lineMaterialId} : {}),
    });
    if (mRes.ok !== true) {
      return {ok: false, error: `[buildVolumeStreamlines] createMesh: ${mRes.error}`, type: mRes.type};
    }
    meshIds.push(`${chunkId}_mesh`);
    chunkPositions = [];
    chunkColors    = [];
    chunkIndices   = [];
    chunkVertexBase = 0;
    chunkIndex++;
    return {ok: true, value: undefined};
  };

  const margin = 0.5;
  for (let iz = 0; iz < seedDensity; iz++) {
    for (let iy = 0; iy < seedDensity; iy++) {
      for (let ix = 0; ix < seedDensity; ix++) {
        const tu = (ix + margin) / seedDensity;
        const tv = (iy + margin) / seedDensity;
        const tw = (iz + margin) / seedDensity;
        const sx = minX + tu * (maxX - minX);
        const sy = minY + tv * (maxY - minY);
        const sz = minZ + tw * (maxZ - minZ);

        const trace = traceStreamline(grid, sx, sy, sz, opts);
        if (trace.length < 8) continue;
        const numVerts = trace.length / 4;

        if (chunkVertexBase + numVerts > MAX_VERTS_PER_MESH) {
          const flush = flushChunk();
          if (flush.ok !== true) { model.destroy(); return flush; }
        }

        for (let v = 0; v < numVerts; v++) {
          const px = trace[v * 4    ];
          const py = trace[v * 4 + 1];
          const pz = trace[v * 4 + 2];
          const sp = trace[v * 4 + 3];
          chunkPositions.push(px, py, pz);
          if (colorMode === "speed") {
            const t = Math.max(0, Math.min(1, (sp - rangeMin) / span));
            const c = sampleColormap(colormap, t);
            chunkColors.push(c[0], c[1], c[2], 1.0);
          } else {
            chunkColors.push(uniformColor[0], uniformColor[1], uniformColor[2], 1.0);
          }
        }
        for (let v = 0; v < numVerts - 1; v++) {
          chunkIndices.push(chunkVertexBase + v, chunkVertexBase + v + 1);
        }
        chunkVertexBase += numVerts;
      }
    }
  }

  const finalFlush = flushChunk();
  if (finalFlush.ok !== true) { model.destroy(); return finalFlush; }

  if (meshIds.length === 0) {
    // Every seed stalled — not an error, just nothing to draw.
    model.destroy();
    return {ok: true, value: null};
  }

  const objResult = model.createObject({id, meshIds});
  if (objResult.ok !== true) {
    model.destroy();
    return {ok: false, error: `[buildVolumeStreamlines] createObject: ${objResult.error}`, type: objResult.type};
  }

  return {ok: true, value: model};
}
