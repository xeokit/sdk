/**
 * # ply — Polygon File Format
 *
 * Imports and exports ASCII PLY mesh and point-cloud data.
 *
 * Supported on import:
 * - `format ascii 1.0`
 * - `vertex` properties `x y z`
 * - optional normals `nx ny nz`
 * - optional UVs `s t`, `u v` or `texture_u texture_v`
 * - optional colors `red green blue alpha`
 * - optional `face` list property with fan-triangulated indices
 *
 * Supported on export:
 * - ASCII PLY 1.0
 * - triangle and point primitives
 * - baked mesh transforms
 * - optional vertex normals, UVs and colors
 *
 * @module ply
 */
export * from "./PLYLoader";
export * from "./PLYExporter";
