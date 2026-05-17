/**
 * Tessellate a STEP B-Rep into a triangle mesh.
 *
 * Walks the SR's items list for `MANIFOLD_SOLID_BREP` /
 * `FACETED_BREP` / `BREP_WITH_VOIDS`; from each, descends through
 * `CLOSED_SHELL → ADVANCED_FACE → FACE_OUTER_BOUND → EDGE_LOOP →
 * ORIENTED_EDGE → EDGE_CURVE → VERTEX_POINT → CARTESIAN_POINT`,
 * then triangulates each planar face's polygon outline.
 *
 * ## What's supported (v1)
 *
 *   - **Surface:** `PLANE` only. Faces sitting on
 *     `CYLINDRICAL_SURFACE`, `CONICAL_SURFACE`, `SPHERICAL_SURFACE`,
 *     `TOROIDAL_SURFACE`, `B_SPLINE_SURFACE_WITH_KNOTS`, etc. emit
 *     zero triangles. Each surface family adds non-trivial
 *     parametric tessellation; one file at a time as needs arise.
 *   - **Edge:** start/end vertex points only. Curves between
 *     endpoints (CIRCLE, B_SPLINE_CURVE) aren't sampled — a planar
 *     face bounded by a circle comes out as a near-degenerate
 *     polygon. Pure LINE-edge bounds (most rectangular pads,
 *     rib walls, etc.) tessellate correctly.
 *   - **Bounds:** the first `FACE_OUTER_BOUND` (or `FACE_BOUND` as
 *     fallback). Holes — multiple bounds per face — are skipped.
 *     Geometry with cutouts will fill them in until ear-clip-with-
 *     holes lands.
 *   - **Triangulation:** simple fan from the first vertex. Works
 *     for convex polygons. Concave faces produce overlapping
 *     triangles; visually "wrong" in the same plane but doesn't
 *     break rendering.
 *   - **Normals:** per-face flat normals from the surface's Z
 *     axis, with `same_sense` flipping when applicable. No
 *     smoothing — CAD edges are hard.
 *   - **Voids:** `BREP_WITH_VOIDS` voids (interior shells) are
 *     also walked, with their normals naturally pointing inward.
 *
 * ## What's not (yet)
 *
 *   - Concave-face ear clipping.
 *   - Hole support (multiple bounds per face).
 *   - Curved edges sampled along their parameter range.
 *   - Curved surfaces tessellated parametrically.
 *   - Vertex deduplication across faces (every face emits its own
 *     vertex copies, which is the right answer for hard edges and
 *     cheap to do — but consumes more memory than necessary).
 *
 * Returns `null` when the walk produces no triangles. Callers fall
 * back to the AABB-sized placeholder cube the rest of the loader
 * already builds.
 *
 * @internal
 */

import {
  type Entity,
  enumArg,
  type InstanceGraph,
  listArg,
  numArg,
  refArg,
} from "./parseInstanceGraph";


export interface TessellatedGeometry {
  positions: Float32Array;
  normals:   Float32Array;
  indices:   Uint32Array;
}


/**
 * Top-level entry. Returns `null` when no triangles emerge — the
 * SR has no BREP, every BREP has only curved surfaces, or every
 * face has fewer than three usable vertex endpoints.
 */
export function tessellateBrep(graph: InstanceGraph, sr: Entity): TessellatedGeometry | null {
  const items = listArg(sr.args[1]);
  if (!items) return null;

  const positions: number[] = [];
  const normals:   number[] = [];
  const indices:   number[] = [];

  for (const item of items) {
    const ref = refArg(item);
    if (ref == null) continue;
    const e = graph.byRef.get(ref);
    if (!e) continue;
    if (BREP_TYPES.has(e.type)) {
      tessellateBrepEntity(graph, e, positions, normals, indices);
    }
  }

  if (indices.length === 0) return null;
  return {
    positions: new Float32Array(positions),
    normals:   new Float32Array(normals),
    indices:   new Uint32Array(indices),
  };
}

const BREP_TYPES: ReadonlySet<string> = new Set([
  "MANIFOLD_SOLID_BREP",
  "FACETED_BREP",
  "BREP_WITH_VOIDS",
]);


// ── BREP → CLOSED_SHELL ─────────────────────────────────────────────

function tessellateBrepEntity(
  graph:     InstanceGraph,
  brep:      Entity,
  positions: number[],
  normals:   number[],
  indices:   number[],
): void {

  // MANIFOLD_SOLID_BREP / FACETED_BREP: ('name', outer (CLOSED_SHELL))
  const outerRef = refArg(brep.args[1]);
  if (outerRef != null) {
    const outer = graph.byRef.get(outerRef);
    if (outer) tessellateShell(graph, outer, positions, normals, indices);
  }

  // BREP_WITH_VOIDS adds a list of inner ORIENTED_CLOSED_SHELLs at args[2].
  // The void shells' normals naturally point inward — emit them as-is so
  // a translucent render shows the interior.
  if (brep.type === "BREP_WITH_VOIDS") {
    const voids = listArg(brep.args[2]);
    if (voids) {
      for (const v of voids) {
        const ref = refArg(v);
        if (ref == null) continue;
        const shell = graph.byRef.get(ref);
        if (!shell) continue;
        tessellateShell(graph, shell, positions, normals, indices);
      }
    }
  }
}


// ── SHELL → FACE ────────────────────────────────────────────────────

function tessellateShell(
  graph:     InstanceGraph,
  shell:     Entity,
  positions: number[],
  normals:   number[],
  indices:   number[],
): void {

  // ORIENTED_CLOSED_SHELL ('name', closed_shell_element, orientation):
  // unwrap to the inner CLOSED_SHELL. Orientation flips the face
  // winding; we don't act on it yet — `same_sense` per face is
  // honoured below, which covers the common case.
  let s: Entity = shell;
  if (s.type === "ORIENTED_CLOSED_SHELL") {
    const ref = refArg(s.args[1]);
    if (ref == null) return;
    const inner = graph.byRef.get(ref);
    if (!inner) return;
    s = inner;
  }

  const faces = listArg(s.args[1]);
  if (!faces) return;
  for (const f of faces) {
    const ref = refArg(f);
    if (ref == null) continue;
    const face = graph.byRef.get(ref);
    if (!face) continue;
    // ADVANCED_FACE is the AP203/AP214/AP242 default; FACE_SURFACE
    // is the older / generic form. Both have the same arg shape.
    if (face.type === "ADVANCED_FACE" || face.type === "FACE_SURFACE") {
      tessellateFace(graph, face, positions, normals, indices);
    }
  }
}


// ── FACE → polygon → triangles ──────────────────────────────────────

function tessellateFace(
  graph:     InstanceGraph,
  face:      Entity,
  positions: number[],
  normals:   number[],
  indices:   number[],
): void {

  // ADVANCED_FACE / FACE_SURFACE:
  //   ('name', bounds, face_geometry, same_sense)
  const bounds      = listArg(face.args[1]);
  const surfaceRef  = refArg(face.args[2]);
  const sameSenseEn = enumArg(face.args[3]);
  // STEP enumeration values: ".T." / ".F.". Default to true on
  // missing — matches typical exporter output.
  const sameSense   = sameSenseEn !== "F";
  if (!bounds || surfaceRef == null) return;

  const surface = graph.byRef.get(surfaceRef);
  if (!surface || surface.type !== "PLANE") return;

  const planeNormal = readPlaneNormal(graph, surface);
  if (!planeNormal) return;

  // Same-sense flip — when false, face normal is opposite the
  // surface's Z axis.
  const sign = sameSense ? 1 : -1;
  const fnx = planeNormal[0] * sign;
  const fny = planeNormal[1] * sign;
  const fnz = planeNormal[2] * sign;

  // Pick the outer bound. FACE_OUTER_BOUND is the conventional
  // marker; FACE_BOUND is a fallback for files that don't tag the
  // outer ring. Holes (additional FACE_BOUNDs alongside an outer)
  // aren't punched yet — they'll just be filled in.
  let outerBound: Entity | null = null;
  for (const b of bounds) {
    const ref = refArg(b);
    if (ref == null) continue;
    const e = graph.byRef.get(ref);
    if (e && e.type === "FACE_OUTER_BOUND") { outerBound = e; break; }
  }
  if (!outerBound) {
    for (const b of bounds) {
      const ref = refArg(b);
      if (ref == null) continue;
      const e = graph.byRef.get(ref);
      if (e && e.type === "FACE_BOUND") { outerBound = e; break; }
    }
  }
  if (!outerBound) return;

  // FACE_OUTER_BOUND / FACE_BOUND ('name', bound (EDGE_LOOP), orientation).
  const loopRef = refArg(outerBound.args[1]);
  const orient  = enumArg(outerBound.args[2]) !== "F";
  if (loopRef == null) return;
  const loop = graph.byRef.get(loopRef);
  if (!loop || loop.type !== "EDGE_LOOP") return;

  const polygon = walkEdgeLoop(graph, loop, /*reversed*/ !orient);
  if (polygon.length < 3) return;

  // Fan triangulation around polygon[0]. Convex faces tessellate
  // correctly; concave faces produce overlapping triangles
  // (acceptable visual artefact until ear-clipping lands).
  const base = positions.length / 3;
  for (const p of polygon) {
    positions.push(p[0], p[1], p[2]);
    normals.push(fnx, fny, fnz);
  }
  for (let i = 1; i < polygon.length - 1; i++) {
    indices.push(base, base + i, base + i + 1);
  }
}


// ── EDGE_LOOP → polygon ─────────────────────────────────────────────

/**
 * Walk an EDGE_LOOP's ordered ORIENTED_EDGEs and collect the start
 * vertex of each one (the "next" vertex of the previous edge — by
 * loop closure they coincide). Curves between endpoints aren't
 * sampled, so a face bounded by an arc shows up as a polygon with
 * just the arc's endpoints — fine for LINE-bounded faces, lossy
 * for curved ones.
 */
function walkEdgeLoop(
  graph:    InstanceGraph,
  loop:     Entity,
  reversed: boolean,
): Array<[number, number, number]> {

  const orientedEdges = listArg(loop.args[1]);
  if (!orientedEdges) return [];

  const polygon: Array<[number, number, number]> = [];
  for (const oe of orientedEdges) {
    const ref = refArg(oe);
    if (ref == null) continue;
    const oeEntity = graph.byRef.get(ref);
    if (!oeEntity || oeEntity.type !== "ORIENTED_EDGE") continue;

    // ORIENTED_EDGE:
    //   ('name', edge_start *, edge_end *, edge_element, orientation)
    // edge_start / edge_end are derived (* in EXPRESS) — usually $
    // in serialised form. Read edge_element (the EDGE_CURVE) and
    // the orientation flag, then pull the "logical start" vertex
    // off the EDGE_CURVE accounting for that flag.
    const edgeRef = refArg(oeEntity.args[3]);
    const orient  = enumArg(oeEntity.args[4]) !== "F";
    if (edgeRef == null) continue;
    const edge = graph.byRef.get(edgeRef);
    if (!edge || edge.type !== "EDGE_CURVE") continue;

    // EDGE_CURVE:
    //   ('name', edge_start (VERTEX_POINT), edge_end (VERTEX_POINT),
    //    edge_geometry, same_sense)
    // When orientation is .F. the start of the oriented edge is the
    // end of the underlying curve.
    const vRef = refArg(orient ? edge.args[1] : edge.args[2]);
    if (vRef == null) continue;
    const point = readVertexPoint(graph, vRef);
    if (point) polygon.push(point);
  }

  if (reversed) polygon.reverse();
  return polygon;
}


// ── Atoms ───────────────────────────────────────────────────────────

function readVertexPoint(
  graph: InstanceGraph,
  ref:   number,
): [number, number, number] | null {
  const vp = graph.byRef.get(ref);
  if (!vp || vp.type !== "VERTEX_POINT") return null;
  // VERTEX_POINT ('name', vertex_geometry (CARTESIAN_POINT)).
  const cpRef = refArg(vp.args[1]);
  if (cpRef == null) return null;
  const cp = graph.byRef.get(cpRef);
  if (!cp || cp.type !== "CARTESIAN_POINT") return null;
  const c = listArg(cp.args[1]);
  if (!c || c.length < 3) return null;
  return [
    numArg(c[0]) ?? 0,
    numArg(c[1]) ?? 0,
    numArg(c[2]) ?? 0,
  ];
}

function readPlaneNormal(
  graph: InstanceGraph,
  plane: Entity,
): [number, number, number] | null {
  // PLANE ('name', position (AXIS2_PLACEMENT_3D)).
  const posRef = refArg(plane.args[1]);
  if (posRef == null) return null;
  const placement = graph.byRef.get(posRef);
  if (!placement || placement.type !== "AXIS2_PLACEMENT_3D") return null;

  // AXIS2_PLACEMENT_3D.axis (args[2]) — Z direction. Default
  // (0, 0, 1) per ISO 10303-42 §4.4.6.5 when omitted.
  const axisRef = refArg(placement.args[2]);
  if (axisRef == null) return [0, 0, 1];
  const dir = graph.byRef.get(axisRef);
  if (!dir || dir.type !== "DIRECTION") return [0, 0, 1];

  const r = listArg(dir.args[1]);
  if (!r || r.length < 3) return null;
  const x = numArg(r[0]) ?? 0;
  const y = numArg(r[1]) ?? 0;
  const z = numArg(r[2]) ?? 1;
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}
