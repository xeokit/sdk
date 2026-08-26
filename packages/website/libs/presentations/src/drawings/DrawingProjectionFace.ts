/**
 * Convenience preset for the six AABB-face projections. Each
 * resolves internally to a {@link ProjectionBasis} aligned with
 * world axes — `"top"` projects along `-worldUp` with the AABB
 * footprint as the image, `"front"` along `+worldForward`, etc.
 * For arbitrary projection directions (oblique / diagonal
 * views), pass a {@link DrawingProjectionRay} instead.
 */
export type DrawingProjectionFace =
  | "top"      // -Y projection onto plane Y = aabb.maxY
  | "bottom"   // +Y projection onto plane Y = aabb.minY
  | "front"    // +Z projection onto plane Z = aabb.minZ
  | "back"     // -Z projection onto plane Z = aabb.maxZ
  | "left"     // +X projection onto plane X = aabb.minX
  | "right";   // -X projection onto plane X = aabb.maxX
