import type {VoxelGrid} from "./VoxelGrid";
import {sampleVoxelGrid, voxelGridDataRange} from "./VoxelGrid";
import {
  COLORMAP_VIRIDIS,
  sampleColormap,
  type ColormapStops,
} from "./colormaps";
import type {Scene, SceneModel} from "../../model/scene";
import {
  TrianglesPrimitive,
  NearestFilter,
  LinearFilter,
  ClampToEdgeWrapping,
  LinearEncoding,
} from "../../base/constants";
import type {SDKResult} from "../../base/core";


/**
 * Slice-plane axis. World coords are Z-up by convention in this SDK.
 * `"z"` gives horizontal slices; `"x"` and `"y"` give vertical slices.
 *
 * @module presentations/volumeOverlay
 */
export type SliceAxis = "x" | "y" | "z";


/**
 * Options for {@link buildVolumeSlicePlane}.
 *
 * @module presentations/volumeOverlay
 */
export interface BuildVolumeSlicePlaneOptions {

  /** SceneModel id. Default `"volumeSlicePlane"`. */
  id?: string;

  /**
   * Which axis the slice is perpendicular to. Default `"z"` for a
   * horizontal slice.
   */
  axis?: SliceAxis;

  /**
   * World-space position along {@link axis} where the slice sits.
   * Defaults to the midpoint of the grid along the chosen axis.
   */
  position?: number;

  /**
   * Sampling resolution on the slice plane, in cells along the two
   * in-plane axes. Higher resolution costs `O(nu · nv)` sample lookups
   * per rebuild. Default `80 × 80`.
   */
  resolution?: [number, number];

  /**
   * Colormap stops. Default `viridis`.
   */
  colormap?: ColormapStops;

  /**
   * Value range mapped to the colormap. Default `grid.valueRange`,
   * or the data-driven min/max when that's unset. Lock this when
   * comparing multiple overlays.
   */
  range?: [number, number];

  /**
   * Opacity for the slice. Default `0.85`.
   */
  opacity?: number;

  /**
   * Offset (in world units) along the slice's normal axis, to
   * lift the slice off any coincident floor / wall surface and
   * avoid Z-fighting. Default `0.02`.
   */
  zOffset?: number;

  /**
   * Texel filtering. Default `"linear"`. Use `"nearest"` for stepped
   * voxel output.
   */
  filter?: "linear" | "nearest";
}


/**
 * Bake a slice through a {@link VoxelGrid} into a SceneModel: a
 * single textured quad whose RGBA texels carry the colormap-mapped
 * scalar values across the slice plane.
 *
 * One SceneModel, one geometry, one material, one texture, one
 * mesh, one object. Total renderer cost is independent of slice
 * resolution. A 200 × 200 slice costs the same to draw as a 20 × 20.
 *
 * The returned SceneModel owns the lifetime of the texture and
 * mesh; destroy it to clear the slice. Returns `SDKResult<SceneModel>`
 * — never throws; SceneModel create-call failures propagate as
 * `ok: false`.
 *
 * @module presentations/volumeOverlay
 */
export function buildVolumeSlicePlane(
  scene: Scene,
  grid: VoxelGrid,
  opts: BuildVolumeSlicePlaneOptions = {},
): SDKResult<SceneModel> {

  const id        = opts.id       ?? "volumeSlicePlane";
  const axis      = opts.axis     ?? "z";
  const filter    = opts.filter   ?? "linear";
  const opacity   = opts.opacity  ?? 0.85;
  const zOffset   = opts.zOffset  ?? 0.02;
  const colormap  = opts.colormap ?? COLORMAP_VIRIDIS;
  const [nu, nv]  = opts.resolution ?? [80, 80];

  const [minX, minY, minZ] = grid.min;
  const [maxX, maxY, maxZ] = grid.max;

  const position = opts.position ?? (axis === "x"
    ? (minX + maxX) * 0.5
    : axis === "y"
    ? (minY + maxY) * 0.5
    : (minZ + maxZ) * 0.5);

  const [rangeMin, rangeMax] = opts.range
    ?? grid.valueRange
    ?? voxelGridDataRange(grid);
  const span = Math.max(1e-6, rangeMax - rangeMin);

  const modelResult = scene.createModel({id});
  if (modelResult.ok !== true) {
    return {ok: false, error: `[buildVolumeSlicePlane] createModel: ${modelResult.error}`, type: modelResult.type};
  }
  const model = modelResult.value;

  const pixels = new Uint8ClampedArray(nu * nv * 4);
  for (let iv = 0; iv < nv; iv++) {
    const tv = (iv + 0.5) / nv;
    for (let iu = 0; iu < nu; iu++) {
      const tu = (iu + 0.5) / nu;
      let wx: number, wy: number, wz: number;
      if (axis === "z") {
        wx = minX + tu * (maxX - minX);
        wy = minY + tv * (maxY - minY);
        wz = position;
      } else if (axis === "y") {
        wx = minX + tu * (maxX - minX);
        wy = position;
        wz = minZ + tv * (maxZ - minZ);
      } else {
        wx = position;
        wy = minY + tu * (maxY - minY);
        wz = minZ + tv * (maxZ - minZ);
      }

      const v = sampleVoxelGrid(grid, wx, wy, wz);
      const o = (iv * nu + iu) * 4;
      if (!Number.isFinite(v)) {
        pixels[o]     = 220;
        pixels[o + 1] = 220;
        pixels[o + 2] = 220;
        pixels[o + 3] = 64;
        continue;
      }
      const t = Math.max(0, Math.min(1, (v - rangeMin) / span));
      const c = sampleColormap(colormap, t);
      pixels[o]     = Math.round(c[0] * 255);
      pixels[o + 1] = Math.round(c[1] * 255);
      pixels[o + 2] = Math.round(c[2] * 255);
      pixels[o + 3] = 255;
    }
  }

  const texResult = model.createTexture({
    id:        `${id}_tex`,
    imageData: {data: pixels, width: nu, height: nv},
    magFilter: filter === "linear" ? LinearFilter : NearestFilter,
    minFilter: filter === "linear" ? LinearFilter : NearestFilter,
    wrapS:     ClampToEdgeWrapping,
    wrapT:     ClampToEdgeWrapping,
    encoding:  LinearEncoding,
    flipY:     false,
  });
  if (texResult.ok !== true) {
    model.destroy();
    return {ok: false, error: `[buildVolumeSlicePlane] createTexture: ${texResult.error}`, type: texResult.type};
  }

  const matResult = model.createMaterial({
    id:             `${id}_mat`,
    color:          [1, 1, 1],
    opacity,
    roughness:      1.0,
    metallic:       0.0,
    colorTextureId: `${id}_tex`,
  });
  if (matResult.ok !== true) {
    model.destroy();
    return {ok: false, error: `[buildVolumeSlicePlane] createMaterial: ${matResult.error}`, type: matResult.type};
  }

  let p0: [number, number, number];
  let p1: [number, number, number];
  let p2: [number, number, number];
  let p3: [number, number, number];
  let normal: [number, number, number];
  if (axis === "z") {
    const z = position + zOffset;
    p0 = [minX, minY, z]; p1 = [maxX, minY, z];
    p2 = [maxX, maxY, z]; p3 = [minX, maxY, z];
    normal = [0, 0, 1];
  } else if (axis === "y") {
    const y = position + zOffset;
    p0 = [minX, y, minZ]; p1 = [maxX, y, minZ];
    p2 = [maxX, y, maxZ]; p3 = [minX, y, maxZ];
    normal = [0, 1, 0];
  } else {
    const x = position + zOffset;
    p0 = [x, minY, minZ]; p1 = [x, maxY, minZ];
    p2 = [x, maxY, maxZ]; p3 = [x, minY, maxZ];
    normal = [1, 0, 0];
  }

  const positions = new Float32Array([
    p0[0], p0[1], p0[2],
    p1[0], p1[1], p1[2],
    p2[0], p2[1], p2[2],
    p3[0], p3[1], p3[2],
  ]);
  const normals = new Float32Array([
    normal[0], normal[1], normal[2],
    normal[0], normal[1], normal[2],
    normal[0], normal[1], normal[2],
    normal[0], normal[1], normal[2],
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
  if (geomResult.ok !== true) {
    model.destroy();
    return {ok: false, error: `[buildVolumeSlicePlane] createGeometry: ${geomResult.error}`, type: geomResult.type};
  }

  const meshResult = model.createMesh({
    id:         `${id}_mesh`,
    geometryId: `${id}_geom`,
    materialId: `${id}_mat`,
  });
  if (meshResult.ok !== true) {
    model.destroy();
    return {ok: false, error: `[buildVolumeSlicePlane] createMesh: ${meshResult.error}`, type: meshResult.type};
  }

  const objResult = model.createObject({id, meshIds: [`${id}_mesh`]});
  if (objResult.ok !== true) {
    model.destroy();
    return {ok: false, error: `[buildVolumeSlicePlane] createObject: ${objResult.error}`, type: objResult.type};
  }

  return {ok: true, value: model};
}
