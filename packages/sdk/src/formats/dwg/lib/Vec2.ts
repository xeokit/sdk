/**
 * 2D point in drawing units: `[x, y]`.
 *
 * Used by 2D-planar entities (e.g. {@link DWGLwPolyline} vertex
 * lists). Z elevation, when relevant, comes from a sibling field
 * on the entity (`elevation`) rather than per-vertex.
 *
 * @private
 */
export type Vec2 = [number, number];
