/**
 * AVEVA RVM primitive type codes (RVM v2 file format).
 *
 * Each primitive in an RVM file is preceded by a `PRIM` chunk header
 * carrying one of these codes, followed by a per-primitive payload of
 * floats describing geometry. The codes themselves are stable across
 * RVM v1, v2, and v3.
 *
 * Implementation status here:
 *   - Pyramid / Box / Snout / Cylinder / Sphere — decoded into
 *     procedurally-built `SceneGeometry`.
 *   - Line / Ellipsoid / Dish / RectTorus / CircTorus — recognised but
 *     not yet decoded; their meshes are skipped with a console warning.
 *   - FacetGroup — recognised; payload is a polygon soup (the most
 *     common form in real plant data) but full decode is TODO.
 *
 * @internal
 */
export enum RVMPrimitive {
  Pyramid     = 1,
  Box         = 2,
  RectTorus   = 3,
  CircTorus   = 4,
  EllipDish   = 5,
  SpherDish   = 6,
  Snout       = 7,
  Cylinder    = 8,
  Sphere      = 9,
  Line        = 10,
  FacetGroup  = 11
}
