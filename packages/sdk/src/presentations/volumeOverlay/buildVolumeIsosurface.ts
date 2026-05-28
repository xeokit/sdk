import type {VoxelGrid} from "./VoxelGrid";
import {voxelGridDataRange} from "./VoxelGrid";
import {
  COLORMAP_VIRIDIS,
  sampleColormap,
  type ColormapStops,
} from "./colormaps";
import {marchingCubes} from "./marchingCubes";
import type {Scene, SceneModel} from "../../model/scene";
import {TrianglesPrimitive} from "../../base/constants";
import type {SDKResult} from "../../base/core";


/**
 * Options for {@link buildVolumeIsosurface}.
 *
 * @module presentations/volumeOverlay
 */
export interface BuildVolumeIsosurfaceOptions {

  /** SceneModel id. Default `"volumeIsosurface"`. */
  id?: string;

  /**
   * Scalar value the iso-surface tracks. Mesh contains the set
   * `{ p ∈ R³ : grid(p) = isovalue }`.
   *
   * Defaults to the midpoint of the grid's value range.
   */
  isovalue?: number;

  /**
   * Surface colour. Default `null` — sample the colormap at the
   * isovalue's normalised position (the colour that pixel would
   * have on a slice through the same field). Pass an explicit
   * `[r, g, b]` to override.
   */
  color?: [number, number, number] | null;

  /**
   * Colormap used when `color === null`. Default `viridis`.
   */
  colormap?: ColormapStops;

  /**
   * Value range mapped to the colormap. Default `grid.valueRange`
   * or the data-driven min/max when unset.
   */
  range?: [number, number];

  /** Surface opacity. Default `0.85`. */
  opacity?: number;
}


/**
 * Extract an iso-surface from a {@link VoxelGrid} and bake it into
 * a SceneModel as a single shaded mesh. The mesh is welded
 * (vertex-shared at cell boundaries) and lit with per-vertex
 * normals from the field's gradient, so the surface appears
 * smooth even on a coarse grid.
 *
 * Returns `{ok: true, value: null}` when the iso-surface is empty
 * (the iso-value falls entirely outside the field's range, or
 * every cell sits on the same side) — an empty result is a
 * legitimate outcome, not an error. SceneModel create-call
 * failures propagate as `ok: false`.
 *
 * @module presentations/volumeOverlay
 */
export function buildVolumeIsosurface(
  scene: Scene,
  grid: VoxelGrid,
  opts: BuildVolumeIsosurfaceOptions = {},
): SDKResult<SceneModel | null> {

  const id        = opts.id      ?? "volumeIsosurface";
  const opacity   = opts.opacity ?? 0.85;
  const colormap  = opts.colormap ?? COLORMAP_VIRIDIS;
  const [rangeMin, rangeMax] = opts.range
    ?? grid.valueRange
    ?? voxelGridDataRange(grid);
  const isovalue  = opts.isovalue ?? (rangeMin + rangeMax) * 0.5;

  const color: [number, number, number] = opts.color ?? (() => {
    const t = Math.max(0, Math.min(1, (isovalue - rangeMin) / Math.max(1e-6, rangeMax - rangeMin)));
    return sampleColormap(colormap, t);
  })();

  const mesh = marchingCubes(grid, isovalue);
  if (!mesh) return {ok: true, value: null};

  const modelResult = scene.createModel({id});
  if (modelResult.ok !== true) {
    return {ok: false, error: `[buildVolumeIsosurface] createModel: ${modelResult.error}`, type: modelResult.type};
  }
  const model = modelResult.value;

  const geomResult = model.createGeometry({
    id:        `${id}_geom`,
    primitive: TrianglesPrimitive,
    positions: mesh.positions,
    normals:   mesh.normals,
    indices:   mesh.indices,
  });
  if (geomResult.ok !== true) {
    model.destroy();
    return {ok: false, error: `[buildVolumeIsosurface] createGeometry: ${geomResult.error}`, type: geomResult.type};
  }

  const matResult = model.createMaterial({
    id:        `${id}_mat`,
    color,
    opacity,
    roughness: 0.6,
    metallic:  0.0,
  });
  if (matResult.ok !== true) {
    model.destroy();
    return {ok: false, error: `[buildVolumeIsosurface] createMaterial: ${matResult.error}`, type: matResult.type};
  }

  const meshResult = model.createMesh({
    id:         `${id}_mesh`,
    geometryId: `${id}_geom`,
    materialId: `${id}_mat`,
  });
  if (meshResult.ok !== true) {
    model.destroy();
    return {ok: false, error: `[buildVolumeIsosurface] createMesh: ${meshResult.error}`, type: meshResult.type};
  }

  const objResult = model.createObject({id, meshIds: [`${id}_mesh`]});
  if (objResult.ok !== true) {
    model.destroy();
    return {ok: false, error: `[buildVolumeIsosurface] createObject: ${objResult.error}`, type: objResult.type};
  }

  return {ok: true, value: model};
}
