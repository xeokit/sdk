import type {Vec3} from "../../../base/math/vector";

/**
 * Per-source-object filled-polygon emission alongside the
 * wireframe edges. The projector derives one fill mesh per
 * source SceneObject from the same depth buffer that drives
 * HLE, so fill silhouettes use the same visibility boundary as
 * the wireframe edges.
 */
export interface FillSpec {
  /**
   * RGB fill colour (each channel in `[0, 1]`) applied to every
   * emitted fill mesh. Default `[0.92, 0.93, 0.95]`.
   */
  color?: Vec3;
  /**
   * Fill opacity in `[0, 1]`. Default `1.0`. Lower values let
   * the panel quad behind show through.
   */
  opacity?: number;
  /**
   * Skip source SceneObjects whose owner buffer has fewer than
   * this many pixels. Filters out salt-and-pepper noise from
   * triangles that only barely win the depth test along
   * an edge they don't really cover. Default `4`.
   */
  minPixelArea?: number;
  /**
   * Douglas-Peucker contour-simplification tolerance, in pixel
   * units. `0.25` (default) preserves sub-pixel detail at the
   * default 2048-px depth-buffer resolution while still
   * collapsing the redundant collinear vertices marching
   * squares emits along straight silhouette edges. `0` keeps
   * every marching-squares vertex (faithful but noisy).
   */
  simplifyEpsilon?: number;
  /**
   * Effective output resolution along the longer (u, v) axis of
   * the basis-rotated AABB, in pixels. Drives fill silhouette
   * precision: 2048 gives ~5 mm/pixel on a 10 m model. Defaults
   * to the matching HLE resolution when {@link DrawingProjectionParams.hideHidden | hideHidden}
   * is enabled, otherwise `2048`.
   */
  resolution?: number;
  /**
   * Per-tile pixel size (square) for the tiled fill extractor.
   * Memory peaks at `O(tileSize²)` regardless of `resolution`,
   * so this bounds memory for high-resolution drawings. Default
   * `1024`. Set to `0` (or any value ≥
   * `resolution`) to disable tiling and use the legacy
   * single-buffer extractor.
   */
  tileSize?: number;
}
