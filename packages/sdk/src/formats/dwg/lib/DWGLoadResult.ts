import type {SceneModel} from "../../../model/scene";


/**
 * Result returned by the DWG v1.0 `parse` / `emit` entry points on
 * success — also returned (as `DXFLoadResult`) by {@link DXFLoader}
 * since DXF shares the same SceneModel-emission pipeline.
 *
 * Counts in this struct are diagnostic — useful for HUD overlays,
 * regression tests, and "did this file actually contain what I
 * expected?" smoke checks. They do not affect the contents of the
 * SceneModel.
 *
 * @private
 */
export interface DWGLoadResult {
  sceneModel:     SceneModel;
  /** Number of line segments emitted across all SceneObjects. */
  segmentCount:   number;
  /** Number of fill triangles emitted (3DFACE + closed-polyline fills). */
  triangleCount:  number;
  /** Number of TEXT / MTEXT labels rasterised as textured quads. */
  textCount:      number;
  /** Number of INSERT entities expanded. */
  insertCount:    number;
  /** Ids of every SceneObject created by the load. */
  sceneObjectIds: string[];
  /** libredwg warning code, when the bytes path was used (0 = clean). */
  parserWarnings?: number;
}
