/**
 * 3D point in drawing units: `[x, y, z]`.
 *
 * Standard position / vector type across the document model — DWG
 * is a 3D format and most entities carry full XYZ even when they
 * happen to be planar.
 *
 * @private
 */
export type Vec3 = [number, number, number];
