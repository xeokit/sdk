/**
 * One source SceneMesh's projected fill, ready to feed into a
 * SceneModel as a TrianglesPrimitive geometry. Positions are
 * laid out as flat XYZ triples in world space, on the projection
 * plane (depth axis fixed at `aabbFaceValue + offset`).
 *
 * Granularity is per source SceneMesh, not per source
 * SceneObject — so callers can emit one fill mesh per source
 * mesh and mirror the source SceneModel's mesh/object
 * hierarchy faithfully (including per-mesh colour).
 */
export interface FillPolygons {
  /** Source SceneObject id (parent of the SceneMesh below). */
  sourceObjectId: string;
  /** Source SceneMesh id this fill represents. */
  sourceMeshId: string;
  /** Flat world-space XYZ positions, ready for `createGeometry`. */
  positions: number[];
  /** Triangle indices into `positions`. */
  indices: number[];
}
