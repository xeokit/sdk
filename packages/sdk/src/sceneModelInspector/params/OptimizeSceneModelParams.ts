import type {SceneModel} from "../../scene";


/** Parameters for {@link optimizeSceneModel}. */
export interface OptimizeSceneModelParams {

  /**
   * SceneModel to optimise. Must be populated (geometries, meshes,
   * objects created).
   */
  sceneModel: SceneModel;

  /**
   * Maximum vertex count per SceneGeometry. Geometries above this
   * threshold are split (see {@link splitSceneGeometry}) into two,
   * and the resulting pieces are re-evaluated; the recursion
   * terminates once every piece is at or below both thresholds.
   *
   * Default `65535` — one less than the Uint16 quantisation cap, so
   * each piece's `positionsCompressed` slots cleanly into a `u16`
   * index space.
   */
  maxVertices?: number;

  /**
   * Maximum primitive count per SceneGeometry — triangles for
   * triangle-indexed geometries (`Triangles` / `Solid` / `Surface`),
   * lines for `Lines`, etc. Geometries above this are split.
   *
   * Default `32768` — comfortable for a single GPU batch while still
   * giving the renderer scope to coalesce many objects together.
   */
  maxPrimitives?: number;
}
