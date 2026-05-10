import type {SceneGeometry, SceneModel} from "../../scene";
import {SolidPrimitive} from "../../constants";
import {findSceneObjectsForGeometry} from "../labels/findSceneObjectsForGeometry";
import type {InspectSceneModelParams} from "../params/InspectSceneModelParams";
import type {Inspection} from "../Inspection";
import type {Issue} from "../Issue";
import type {SceneModelInspectionIndex} from "../internal/SceneModelInspectionIndex";
import {getInspectionIndex} from "../internal/getInspectionIndex";
import {isFiniteAABB, isTriangleMesh} from "./util";


/**
 * **Opt-in** ({@link InspectSceneModelParams.checkGeometryQuality}).
 * Five geometry-quality checks the SDK's `createGeometry`
 * lifecycle gate doesn't enforce — these are *quality* concerns,
 * not data-shape errors:
 *
 *   - `GEOMETRY_ZERO_VOLUME_AABB` — AABB collapsed to a point or
 *     a line segment (one or more axes have zero extent). Likely
 *     a single-point / single-line geometry that won't render
 *     visibly.
 *   - `GEOMETRY_DEGENERATE_TRIANGLES` — one or more triangles
 *     have repeated indices (e.g. `[7, 7, 12]`) or near-zero
 *     cross-product magnitude. Render nothing but cost vertex /
 *     fragment work.
 *   - `GEOMETRY_UNUSED_VERTICES` — positions exist that no
 *     `indices` / `edgeIndices` entry references. Wasted vertex
 *     buffer + per-vertex shader work for non-indexed renders.
 *   - `GEOMETRY_DUPLICATE_VERTICES` — two or more vertex slots are
 *     byte-identical across every populated attribute (positions,
 *     normals, UVs). Coalescing them shrinks the vertex buffer
 *     without altering any rendered surface — vertex splitting
 *     for genuine seam / crease cases produces *different*
 *     normals or UVs, so those slots wouldn't match.
 *   - `GEOMETRY_NON_WATERTIGHT` — primitive is `SolidPrimitive`
 *     but at least one triangle edge is shared by != 2 faces. The
 *     geometry isn't actually a closed manifold; downstream
 *     pipelines that rely on solid semantics (back-face culling
 *     decisions, IFC inside / outside, BVH closed-cell
 *     containment) will misbehave.
 *   - `GEOMETRY_INCONSISTENT_WINDING` — two or more adjacent
 *     triangles traverse a shared edge in the *same* direction
 *     (manifold meshes have each edge traversed in opposite
 *     directions by its two faces). Causes backface-cull
 *     artefacts: faces randomly disappear depending on the camera
 *     side. Independent of `GEOMETRY_NON_WATERTIGHT` — both can
 *     fire on the same mesh.
 *   - `GEOMETRY_AABB_NOT_TIGHT` — the actual u16 range used in
 *     `positionsCompressed` covers less than
 *     {@link InspectSceneModelParams.minAabbFill | minAabbFill}
 *     of the available `[0, 65535]` quantisation grid on at
 *     least one axis. Wasted precision; loaders sometimes emit
 *     a generous AABB and never re-tighten it.
 *   - `GEOMETRY_DUPLICATE_INDICES` — the same triangle (same
 *     three vertex ids, in any rotation / winding) appears more
 *     than once in `indices`. Causes invisible overdraw. Distinct
 *     from `GEOMETRY_DUPLICATE_VERTICES` (different vertex slots
 *     with identical attribute bytes).
 *
 * Pure read pass — no mutation. Each issue carries a
 * `highlight.objectIds` payload built from
 * {@link findSceneObjectsForGeometry} so the example UI can
 * locate the affected SceneObjects in the Viewer.
 */
export const geometryQuality: Inspection = {

  codes: [
    "GEOMETRY_ZERO_VOLUME_AABB",
    "GEOMETRY_DEGENERATE_TRIANGLES",
    "GEOMETRY_UNUSED_VERTICES",
    "GEOMETRY_DUPLICATE_VERTICES",
    "GEOMETRY_NON_WATERTIGHT",
    "GEOMETRY_INCONSISTENT_WINDING",
    "GEOMETRY_AABB_NOT_TIGHT",
    "GEOMETRY_DUPLICATE_INDICES",
  ],

  description: "Geometry quality (triangles, vertices, winding, AABB)",

  labels: {
    GEOMETRY_ZERO_VOLUME_AABB:     "Zero-volume AABB",
    GEOMETRY_DEGENERATE_TRIANGLES: "Degenerate triangles",
    GEOMETRY_UNUSED_VERTICES:      "Unused vertices",
    GEOMETRY_DUPLICATE_VERTICES:   "Duplicate vertices",
    GEOMETRY_NON_WATERTIGHT:       "Non-watertight solid",
    GEOMETRY_INCONSISTENT_WINDING: "Inconsistent triangle winding",
    GEOMETRY_AABB_NOT_TIGHT:       "Loose AABB",
    GEOMETRY_DUPLICATE_INDICES:    "Duplicate triangles",
  },

  descriptions: {
    GEOMETRY_ZERO_VOLUME_AABB:
      "Geometry's AABB has zero extent on at least one axis — every vertex shares a coordinate. The shape collapses to a plane, line, or point, and picking and culling can't act on it usefully.",
    GEOMETRY_DEGENERATE_TRIANGLES:
      "One or more triangles have repeated vertex indices (e.g. [7, 7, 12]) or near-zero cross-product magnitude — they have zero area and never rasterise, but still cost vertex and primitive work.",
    GEOMETRY_UNUSED_VERTICES:
      "Some vertex slots in the buffer are never referenced by any index. They take memory and are paid for in non-indexed shading paths despite contributing nothing to the surface.",
    GEOMETRY_DUPLICATE_VERTICES:
      "Multiple vertex slots are byte-identical across positions, normals, and UVs. Coalescing them shrinks the buffer and lets the GPU's post-transform vertex cache hit. Genuine seam / crease vertices have different attributes and aren't affected.",
    GEOMETRY_NON_WATERTIGHT:
      "Geometry is declared as a closed solid but its surface has open edges (an edge shared by ≠ 2 faces). Solid-only operations — back-face culling decisions, shadow volumes, inside / outside tests — give wrong answers.",
    GEOMETRY_INCONSISTENT_WINDING:
      "Two or more adjacent triangles traverse a shared edge in the same direction. Manifold meshes always traverse a shared edge in opposite directions; the inconsistency causes back-face-cull dropouts and breaks generated normals along the seam.",
    GEOMETRY_AABB_NOT_TIGHT:
      "The actual u16 range used in compressed positions covers only a fraction of the available quantisation grid — the stored AABB is looser than the real vertex bounds. Quantisation precision is wasted; re-tightening lets every vertex use the full 16-bit range.",
    GEOMETRY_DUPLICATE_INDICES:
      "The same triangle (same three vertex ids, any rotation or winding) appears more than once in the index buffer. Causes invisible overdraw and z-fighting. Distinct from duplicate vertex *slots*.",
  },

  optIn: true,
  paramsKey: "checkGeometryQuality",

  run(
    sceneModel: SceneModel,
    params: InspectSceneModelParams,
    index?: SceneModelInspectionIndex,
  ): Issue[] {
    if (!params.checkGeometryQuality) return [];
    const ix = index ?? getInspectionIndex(sceneModel);

    const issues: Issue[] = [];
    for (const id in sceneModel.geometries) {
      const geom = sceneModel.geometries[id];
      if (geom.destroyed) continue;
      if (!geom.positionsCompressed) continue;
      if (!geom.aabb) continue;
      checkGeometry(geom, sceneModel, ix, issues, params);
    }
    return issues;
  },
};


function checkGeometry(
  geom: SceneGeometry,
  sceneModel: SceneModel,
  index: SceneModelInspectionIndex,
  issues: Issue[],
  params: InspectSceneModelParams,
): void {
  const id = geom.id;

  // Highlight payload — same SceneObjects across every issue
  // emitted for this geometry; the UI lights up exactly the meshes
  // a downstream fix would touch.
  const owners = findSceneObjectsForGeometry(sceneModel, id);
  const hl = owners.length > 0 ? {highlight: {objectIds: owners}} : {};

  // ── Zero-volume AABB ─────────────────────────────────────────
  if (isFiniteAABB(geom.aabb!)) {
    const dx = geom.aabb![3] - geom.aabb![0];
    const dy = geom.aabb![4] - geom.aabb![1];
    const dz = geom.aabb![5] - geom.aabb![2];
    if (dx <= 0 || dy <= 0 || dz <= 0) {
      const collapsed: string[] = [];
      if (dx <= 0) collapsed.push("X");
      if (dy <= 0) collapsed.push("Y");
      if (dz <= 0) collapsed.push("Z");
      issues.push({
        severity: "warning",
        code:     "GEOMETRY_ZERO_VOLUME_AABB",
        message:  `SceneGeometry '${id}' AABB has zero extent on ${collapsed.join("+")} — degenerate (point or line); won't render visibly`,
        summary:  `zero on ${collapsed.join("+")}`,
        resourceId: id,
        ...hl,
      });
    }
  }

  // ── AABB not tight ──────────────────────────────────────────
  // Walk positionsCompressed, find the actual u16 footprint per
  // axis. If the used range is below `minAabbFill` of the
  // available [0, 65535] grid, we're wasting quantisation
  // precision — the AABB was authored generously and never
  // re-tightened. Cheap O(verts) integer scan; no decompression.
  // Doesn't depend on triangle topology, so it runs before the
  // triangle-only return.
  {
    const positionsCompressed = geom.positionsCompressed!;
    const vertCount0 = (positionsCompressed.length / 3) | 0;
    if (vertCount0 > 0) {
      let minU0 = 65535, minU1 = 65535, minU2 = 65535;
      let maxU0 = 0,     maxU1 = 0,     maxU2 = 0;
      for (let i = 0; i < positionsCompressed.length; i += 3) {
        const x = positionsCompressed[i];
        const y = positionsCompressed[i + 1];
        const z = positionsCompressed[i + 2];
        if (x < minU0) minU0 = x; if (x > maxU0) maxU0 = x;
        if (y < minU1) minU1 = y; if (y > maxU1) maxU1 = y;
        if (z < minU2) minU2 = z; if (z > maxU2) maxU2 = z;
      }
      const fillX = (maxU0 - minU0) / 65535;
      const fillY = (maxU1 - minU1) / 65535;
      const fillZ = (maxU2 - minU2) / 65535;
      const minFill = Math.min(fillX, fillY, fillZ);
      const threshold = params.minAabbFill ?? 0.5;
      if (minFill < threshold) {
        issues.push({
          severity: "warning",
          code:     "GEOMETRY_AABB_NOT_TIGHT",
          message:  `SceneGeometry '${id}' uses ${(minFill * 100).toFixed(1)}% of the u16 quantisation range on at least one axis (fill X=${(fillX*100).toFixed(1)}%, Y=${(fillY*100).toFixed(1)}%, Z=${(fillZ*100).toFixed(1)}%; threshold ${(threshold*100).toFixed(0)}%) — re-tighten via tightenAabb to recover precision`,
          summary:  `fill ${(fillX*100|0)}% / ${(fillY*100|0)}% / ${(fillZ*100|0)}%`,
          resourceId: id,
          context:   {fill: [fillX, fillY, fillZ], threshold},
          ...hl,
        });
      }
    }
  }

  // The remaining checks all assume triangle topology + indices.
  if (!isTriangleMesh(geom) || !geom.indices) return;
  const indices = geom.indices;
  const triCount = (indices.length / 3) | 0;
  if (triCount === 0) return;
  const vertCount = (geom.positionsCompressed!.length / 3) | 0;

  // ── Degenerate triangles ────────────────────────────────────
  // Two-stage: (a) repeated indices (free, deterministic);
  // (b) near-zero cross-product magnitude (catches collinear
  // triangles whose vertices are merely *close*, not equal).
  let degenerate = 0;
  // Decompressed positions come from the index — shared with any
  // other inspection / fix in the same pass that needs them.
  let positions: Float32Array | null = null;
  for (let t = 0; t < triCount; t++) {
    const i0 = indices[t * 3];
    const i1 = indices[t * 3 + 1];
    const i2 = indices[t * 3 + 2];
    if (i0 === i1 || i1 === i2 || i0 === i2) {
      degenerate++;
      continue;
    }
    if (!positions) {
      positions = index.decompressedPositions(geom.id);
    }
    const ax = positions[i0 * 3], ay = positions[i0 * 3 + 1], az = positions[i0 * 3 + 2];
    const ex1 = positions[i1 * 3]     - ax;
    const ey1 = positions[i1 * 3 + 1] - ay;
    const ez1 = positions[i1 * 3 + 2] - az;
    const ex2 = positions[i2 * 3]     - ax;
    const ey2 = positions[i2 * 3 + 1] - ay;
    const ez2 = positions[i2 * 3 + 2] - az;
    const nx = ey1 * ez2 - ez1 * ey2;
    const ny = ez1 * ex2 - ex1 * ez2;
    const nz = ex1 * ey2 - ey1 * ex2;
    if (nx * nx + ny * ny + nz * nz <= DEGENERATE_AREA_EPS_SQ) degenerate++;
  }
  if (degenerate > 0) {
    issues.push({
      severity: "warning",
      code:     "GEOMETRY_DEGENERATE_TRIANGLES",
      message:  `SceneGeometry '${id}' has ${degenerate} of ${triCount} triangles with zero area (repeated indices or collinear vertices) — costs GPU work but renders nothing`,
      summary:  `${degenerate.toLocaleString()} of ${triCount.toLocaleString()} triangles`,
      resourceId: id,
      context:   {degenerate, triCount},
      ...hl,
    });
  }

  // ── Unused vertices ─────────────────────────────────────────
  // Bitmap over vertex slots from the index — shared with the
  // compactUnusedVertices fix.
  const used = index.vertexUsageMask(geom.id);
  let unused = 0;
  for (let i = 0; i < vertCount; i++) if (!used[i]) unused++;
  if (unused > 0) {
    issues.push({
      severity: "warning",
      code:     "GEOMETRY_UNUSED_VERTICES",
      message:  `SceneGeometry '${id}' has ${unused} of ${vertCount} vertex slots that no index references — wasted vertex buffer`,
      summary:  `${unused.toLocaleString()} of ${vertCount.toLocaleString()} vertices`,
      resourceId: id,
      context:   {unused, vertCount},
      ...hl,
    });
  }

  // ── Duplicate vertices ──────────────────────────────────────
  // Canonical-slot map from the index — shared with the
  // mergeDuplicateVertices fix, so a follow-up apply doesn't
  // re-hash the vertex set.
  const slots = index.canonicalSlots(geom.id);
  if (slots) {
    const duplicate = vertCount - slots.uniqueCount;
    if (duplicate > 0) {
      issues.push({
        severity: "warning",
        code:     "GEOMETRY_DUPLICATE_VERTICES",
        message:  `SceneGeometry '${id}' has ${duplicate} of ${vertCount} vertex slots that duplicate another (positions + normals + UVs all match) — coalesce safely`,
        summary:  `${duplicate.toLocaleString()} of ${vertCount.toLocaleString()} vertices`,
        resourceId: id,
        context:   {duplicate, vertCount},
        ...hl,
      });
    }
  }

  // ── Non-watertight solid ────────────────────────────────────
  // Only meaningful for SolidPrimitive — Surface / Triangles
  // make no closed-manifold claim. Build an undirected-edge map
  // (orderless pair, lower id first) → incidence count; a
  // watertight closed manifold has every edge shared by exactly
  // two faces.
  if (geom.primitive === SolidPrimitive) {
    const edgeMap = index.undirectedEdgeIncidence(geom.id);
    if (edgeMap) {
      let badEdges = 0;
      for (const count of edgeMap.values()) if (count !== 2) badEdges++;
      if (badEdges > 0) {
        issues.push({
          severity: "warning",
          code:     "GEOMETRY_NON_WATERTIGHT",
          message:  `SceneGeometry '${id}' is declared SolidPrimitive but ${badEdges} edges aren't shared by exactly two faces — not actually a closed manifold; downgrade to SurfacePrimitive`,
          summary:  `${badEdges} non-2-faced edge${badEdges === 1 ? "" : "s"}`,
          resourceId: id,
          context:   {badEdges, totalEdges: edgeMap.size},
          ...hl,
        });
      }
    }
  }

  // ── Duplicate triangles ─────────────────────────────────────
  // Canonical-keys + duplicate-count from the index. The set
  // itself is shared with the dropDuplicateTriangles fix; the
  // count drives this inspection.
  const triInfo = index.canonicalTriangleKeys(geom.id);
  const duplicateTris = triInfo ? triInfo.duplicateCount : 0;
  if (duplicateTris > 0) {
    issues.push({
      severity: "warning",
      code:     "GEOMETRY_DUPLICATE_INDICES",
      message:  `SceneGeometry '${id}' has ${duplicateTris} of ${triCount} triangles that duplicate another (same vertex set, any rotation / winding) — invisible overdraw; prune via dropDuplicateTriangles`,
      summary:  `${duplicateTris.toLocaleString()} of ${triCount.toLocaleString()} triangles`,
      resourceId: id,
      context:   {duplicate: duplicateTris, triCount},
      ...hl,
    });
  }

  // ── Inconsistent triangle winding ───────────────────────────
  // Manifold meshes have each shared edge traversed in opposite
  // directions by its two adjacent triangles. So if any *directed*
  // edge appears more than once across the triangle list, two
  // adjacent triangles wind the same way → backface-cull artefacts
  // in the renderer (faces randomly disappear depending on the
  // camera side). Independent of the watertight check above; both
  // can fire on the same mesh. Directed-edge map from the index.
  const dirEdges = index.directedEdgeIncidence(geom.id);
  let conflicting = 0;
  if (dirEdges) {
    for (const count of dirEdges.values()) if (count > 1) conflicting++;
  }
  if (conflicting > 0) {
    issues.push({
      severity: "warning",
      code:     "GEOMETRY_INCONSISTENT_WINDING",
      message:  `SceneGeometry '${id}' has ${conflicting} directed edges shared by ≥2 triangles in the same direction — adjacent faces wind inconsistently (backface-cull artefacts); unify via unifyTriangleWinding`,
      summary:  `${conflicting} same-direction edge${conflicting === 1 ? "" : "s"}`,
      resourceId: id,
      context:   {conflictingEdges: conflicting},
      ...hl,
    });
  }
}


/**
 * Cross-product-squared magnitude below this is "zero area" — the
 * triangle's three vertices are effectively collinear in
 * world-scale units. Squared because we compare against the
 * pre-sqrt squared length.
 */
const DEGENERATE_AREA_EPS_SQ = 1e-20;
