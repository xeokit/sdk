import type {SceneGeometry, SceneModel} from "../../model/scene";
import type {HeatMapGridOptions, HeatMapStop} from "../../model/procgen/paintMaterials";


/** Parameters for {@link applyHeatMapMaterials}. */
export interface ApplyHeatMapMaterialsParams {

  /** SceneModel to paint. */
  sceneModel: SceneModel;

  /**
   * Returns the per-vertex scalar field for one geometry. Length must
   * equal `geometry.positionsCompressed.length / 3`.
   *
   * Default: world-space elevation along the SceneModel's `worldUp`
   * axis — the per-vertex height in metres.
   */
  scalars?: (geometry: SceneGeometry) => ArrayLike<number>;

  /**
   * Scalar range mapped onto the colour ramp's `[0, 1]` domain. When
   * supplied, every geometry shares this range so values are visually
   * comparable across the scene. When omitted, the range is auto-
   * computed from the **union** of all per-geometry scalars — also
   * comparable cross-scene, just without a fixed scale.
   *
   * Pass `"perGeometry"` to instead normalise each geometry to its
   * own min/max (each geometry uses its full ramp regardless of how
   * its values sit in the global distribution). Useful for emphasis,
   * misleading for comparison.
   */
  range?: [number, number] | "perGeometry";

  /**
   * Texture size in pixels (square). Default `512`. Larger sizes give
   * more pixels per triangle in the painted heat map and reduce
   * minification moiré on dense geometries — the renderer doesn't
   * generate mipmaps for scene textures, so the painted base level
   * is the only level the GPU samples.
   */
  textureSize?: number;

  /** Colour ramp. Defaults to the painter's `DEFAULT_HEATMAP_RAMP`. */
  ramp?: ReadonlyArray<HeatMapStop>;

  /** Roughness written into every heat map's `mr`. Default `0.6`. */
  roughness?: number;

  /** Metallic written into every heat map's `mr`. Default `0`. */
  metallic?: number;

  /** RGB fill for UV pixels not covered by any triangle. Default `[0, 0, 0]`. */
  backgroundColor?: [number, number, number];

  /**
   * Optional debug grid overlay drawn on each heat map. Useful for
   * inspecting how the planar projection laid each geometry's UVs
   * into texture space. Pass `true` for the painter's defaults, an
   * options object for control, or omit/`false` to skip.
   */
  grid?: boolean | HeatMapGridOptions;

  /**
   * When `true`, geometries that already carry `uvsCompressed` are
   * painted using those UVs verbatim rather than re-projected. Use
   * for shapes whose faces would collapse under planar projection
   * (axis-aligned boxes, cylinders aligned with worldUp) when the
   * caller has pre-baked a per-face unwrap. Default `false` — the
   * painter regenerates planar UVs, which is correct for most
   * irregular meshes (IFC walls, slabs, doors, etc.).
   */
  preserveExistingUvs?: boolean;

  /**
   * Floor on the heat-map material's opacity when the original mesh
   * material was transparent (e.g. IFC windows, curtain wall). The
   * heat map adopts `max(originalOpacity, this)` and the original
   * `alphaMode` (typically `BLEND` for glass). Set to `1` to make
   * heat maps fully opaque regardless of the underlying mesh; set
   * lower (or to `0`) to fully preserve the original opacity.
   * Default `0.5` — keeps glass readable as glass while still
   * showing the gradient.
   */
  transparentOpacityFloor?: number;
}
