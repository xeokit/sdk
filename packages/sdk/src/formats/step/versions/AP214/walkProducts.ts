/**
 * Walk a STEP {@link InstanceGraph} from each `PRODUCT_DEFINITION`
 * occurrence to its world-space placement matrix.
 *
 * Top-down traversal:
 *
 *   1. Find every PD that is *not* the child side of any NAUO —
 *      these are the **roots** of the assembly forest.
 *   2. Recursively visit each root and emit one
 *      {@link ResolvedProduct} for every reachable occurrence,
 *      composing per-level transforms as we descend.
 *
 * Composition chain (per ISO 10303-41/42):
 *
 * ```
 * NEXT_ASSEMBLY_USAGE_OCCURRENCE
 *   (relating_pd = parent, related_pd = child)
 *
 * CONTEXT_DEPENDENT_SHAPE_REPRESENTATION
 *   (representation_relation, represented_product_relation = #NAUO)
 *
 * REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION
 *   (..., transformation_operator = #ITEM_DEFINED_TRANSFORMATION)
 *
 * ITEM_DEFINED_TRANSFORMATION
 *   ('name', 'description', transform_item_1, transform_item_2)
 *
 * relative = matrix_of(item_2) × inverse(matrix_of(item_1))
 * ```
 *
 * The matrix math models the IDT semantics correctly: it places
 * a frame currently at item_1 onto the location of item_2.
 *
 * Local placement chain (for roots and for the SR each occurrence
 * inherits its geometry from):
 *
 * ```
 * PRODUCT_DEFINITION_SHAPE (definition = #PD)
 *   ← SHAPE_DEFINITION_REPRESENTATION
 *       (definition = #SHAPE_DEF, used_representation = #REP)
 *     → SHAPE_REPRESENTATION (or one of its subtypes —
 *        ADVANCED_BREP_SHAPE_REPRESENTATION,
 *        MANIFOLD_SURFACE_SHAPE_REPRESENTATION, etc.)
 *       .items contains an AXIS2_PLACEMENT_3D directly,
 *       or a MAPPED_ITEM whose `mapping_target` is one.
 * ```
 *
 * ## Multi-instance
 *
 * A PD used in N NAUOs (e.g. four bolts in an assembly) yields N
 * separate `ResolvedProduct` entries — one per occurrence — each
 * with its own world matrix. Each entry's
 * {@link ResolvedProduct.objectId} is unique:
 *
 *   - When a PRODUCT appears only once it keeps its raw `id`.
 *   - When it appears N>1 times the entries get suffixed
 *     `id#1, id#2, …` in walk order.
 *
 * ## Cycle guard
 *
 * Recursion tracks the chain of (NAUO, PD) hops in a `path` array.
 * If a child PD already appears in the current path, the back-edge
 * is dropped and traversal continues. STEP files shouldn't have
 * circular assemblies; malformed exports occasionally do.
 *
 * ## Still TODO
 *
 *   - **B-Rep tessellation.** The MANIFOLD_SOLID_BREP walker that
 *     produces real triangulated geometry. Multi-session piece.
 *   - **Faster repeat resolution.** When a sub-assembly is used N
 *     times, we re-walk the whole sub-tree per occurrence; a cache
 *     keyed by sub-tree root would skip the redundant work.
 *
 * @internal
 */

import {
  createMat4Float64,
  identityMat4,
  inverseMat4,
  type Mat4,
  mulMat4,
} from "../../../../base/math/matrix";
import {
  type Entity,
  type InstanceGraph,
  listArg,
  numArg,
  refArg,
  strArg,
  type Value,
} from "./parseInstanceGraph";
import {tessellateBrep, type TessellatedGeometry} from "./tessellateBrep";


/** One PRODUCT occurrence resolved to a world-space placement. */
export interface ResolvedProduct {
  /** `#N` of the PRODUCT entity. Multiple ResolvedProducts can
   *  share this when the PRODUCT is used in multiple occurrences. */
  ref: number;
  /** PRODUCT's `id` arg — the part identifier. */
  id: string;
  /** PRODUCT's `name` arg. */
  name: string;
  /** PRODUCT's `description` arg. */
  description: string;
  /**
   * Unique-per-occurrence id for downstream SceneObject emission.
   * Equals {@link id} when the PRODUCT has a single occurrence;
   * suffixed `id#1, id#2, …` when there are more, in walk order.
   */
  objectId: string;
  /**
   * 4×4 column-major world matrix — composes the local SR
   * placement up the assembly chain via per-NAUO IDT transforms.
   * Identity when the chain didn't resolve.
   */
  matrix: Mat4;
  /**
   * `true` if the chain resolved to a real placement somewhere
   * (local or via assembly composition). Lets callers tell "at
   * the origin because the file said so" from "at the origin by
   * default".
   */
  hasPlacement: boolean;
  /**
   * AABB of every `CARTESIAN_POINT` reachable from the BREP-like
   * items in this PD's local SHAPE_REPRESENTATION, in
   * **PD-local** coordinates (the same frame {@link matrix}
   * places into world space). Six floats: `[minX, minY, minZ,
   * maxX, maxY, maxZ]`. Undefined when the SR has no BREP-like
   * geometry (e.g. assembly-only PDs that only carry an AXIS
   * placement and a MAPPED_ITEM). Used to size the placeholder
   * cube when {@link geometry} is absent.
   */
  aabb?: [number, number, number, number, number, number];
  /**
   * Triangulated geometry produced by walking this PD's BREP.
   * Shared by reference across every occurrence of this PD —
   * callers building scene resources should `Map<TessellatedGeometry,
   * geometryId>` to dedup. Undefined when tessellation produced
   * zero triangles (no BREP, all-curved surfaces, all-degenerate
   * faces); callers fall back to the AABB-scaled placeholder cube.
   */
  geometry?: TessellatedGeometry;
}


export function walkProducts(graph: InstanceGraph): ResolvedProduct[] {

  // Find roots: PDs that aren't a child in any NAUO.
  const childPdRefs = new Set<number>();
  for (const nauo of graph.byType.get("NEXT_ASSEMBLY_USAGE_OCCURRENCE") ?? []) {
    const r = refArg(nauo.args[4]);
    if (r != null) childPdRefs.add(r);
  }
  const allPds = graph.byType.get("PRODUCT_DEFINITION") ?? [];
  const rootPds = allPds.filter(pd => !childPdRefs.has(pd.ref));

  // Per-PD caches. Multi-instance PDs hit these once and reuse the
  // results across all occurrences — the geometry is the same; only
  // the world matrix differs.
  const aabbByPd = new Map<number, [number, number, number, number, number, number] | null>();
  const geomByPd = new Map<number, TessellatedGeometry | null>();

  const ctx: VisitCtx = {graph, aabbByPd, geomByPd};
  const out: ResolvedProduct[] = [];
  for (const root of rootPds) {
    visit(ctx, root, /*parentMat*/ null, /*path*/ [root.ref], out);
  }

  // Some malformed files have PDs that are children but whose parent
  // doesn't appear as a root (orphaned subtrees). Catch them so they
  // still surface in the result, with their local placement only.
  const visited = new Set(out.map(r => r.ref));
  if (out.length < allPds.length) {
    for (const pd of allPds) {
      const product = findProductForPD(graph, pd);
      if (!product) continue;
      if (visited.has(product.ref)) continue;
      visit(ctx, pd, /*parentMat*/ null, [pd.ref], out);
      visited.add(product.ref);
    }
  }

  // Final fallback: PRODUCTs with no PRODUCT_DEFINITION at all.
  // Common in skeletal / partially-authored files; the regression
  // tests deliberately include one so the walker doesn't drop
  // them silently.
  for (const product of graph.byType.get("PRODUCT") ?? []) {
    if (visited.has(product.ref)) continue;
    out.push({
      ref:          product.ref,
      id:           strArg(product.args[0]) ?? "",
      name:         strArg(product.args[1]) ?? "",
      description:  strArg(product.args[2]) ?? "",
      objectId:     "",
      matrix:       identityMat4(createMat4Float64()),
      hasPlacement: false,
    });
    visited.add(product.ref);
  }

  // Suffix occurrenceIds when a PRODUCT appears more than once.
  return assignObjectIds(out);
}


// ── Recursion ───────────────────────────────────────────────────────

/** State threaded through the recursive walk. */
interface VisitCtx {
  graph:     InstanceGraph;
  /** PD-ref → local AABB. `null` means "we tried, no BREP found";
   *  absent means "haven't tried yet". */
  aabbByPd:  Map<number, [number, number, number, number, number, number] | null>;
  /** PD-ref → tessellated geometry, with the same null/absent
   *  semantics as {@link aabbByPd}. */
  geomByPd:  Map<number, TessellatedGeometry | null>;
}

/**
 * Visit a PD: emit a ResolvedProduct for its PRODUCT, then recurse
 * into each NAUO child. `parentMat` is the world matrix of the PD
 * we descended from; `null` at the root.
 */
function visit(
  ctx:       VisitCtx,
  pd:        Entity,
  parentMat: Mat4 | null,
  path:      number[],
  out:       ResolvedProduct[],
): void {

  const {graph} = ctx;

  // SR is the source of both the local placement (root only) and
  // the BREP AABB (any PD). Look it up once.
  const sr = findLocalSr(graph, pd);

  // World matrix for *this* PD's occurrence:
  //   - Root: take the PD's own SR placement (its local frame in
  //     the model context).
  //   - Non-root: the parent already passed its world matrix in
  //     `parentMat`, composed with the per-NAUO relative transform
  //     before recursion. Use it directly.
  let myMat: Mat4;
  let myHasPlacement: boolean;
  if (parentMat) {
    myMat = parentMat;
    myHasPlacement = true;
  } else {
    const local = sr ? findFirstPlacementInSRItems(graph, sr) : null;
    if (local) {
      myMat = local;
      myHasPlacement = true;
    } else {
      myMat = identityMat4(createMat4Float64());
      myHasPlacement = false;
    }
  }

  const aabb     = getLocalAabb(ctx, pd, sr);
  const geometry = getLocalGeometry(ctx, pd, sr);

  const product = findProductForPD(graph, pd);
  if (product) {
    out.push({
      ref:          product.ref,
      id:           strArg(product.args[0]) ?? "",
      name:         strArg(product.args[1]) ?? "",
      description:  strArg(product.args[2]) ?? "",
      objectId:     "",   // filled in by assignObjectIds
      matrix:       myMat,
      hasPlacement: myHasPlacement,
      aabb:         aabb     ?? undefined,
      geometry:     geometry ?? undefined,
    });
  }

  // Recurse into children — every NAUO with this PD as the parent
  // (relating side, args[3]).
  const childUsages = findReferrersOfType(graph, pd.ref, "NEXT_ASSEMBLY_USAGE_OCCURRENCE")
    .filter(n => refArg(n.args[3]) === pd.ref);

  for (const nauo of childUsages) {
    const childRef = refArg(nauo.args[4]);
    if (childRef == null) continue;
    if (path.includes(childRef)) continue; // cycle guard
    const childPd = graph.byRef.get(childRef);
    if (!childPd) continue;

    const relativeMat = resolveAssemblyTransform(graph, nauo);
    const childMat = relativeMat
      ? mulMat4(myMat, relativeMat, createMat4Float64())
      : myMat;

    visit(ctx, childPd, childMat, [...path, childRef], out);
  }
}


// ── Local SR + AABB ─────────────────────────────────────────────────

/**
 * Walk PD → PRODUCT_DEFINITION_SHAPE → SHAPE_DEFINITION_REPRESENTATION
 * → SHAPE_REPRESENTATION. Used by both the placement walk (root
 * PDs) and the AABB walk (every PD). Returns `null` when any hop
 * is missing; both consumers fall back gracefully.
 */
function findLocalSr(graph: InstanceGraph, pd: Entity): Entity | null {
  const shapeDef = findReferrerByTypeAndArg(graph, pd.ref, "PRODUCT_DEFINITION_SHAPE", 2);
  if (!shapeDef) return null;
  const sdRep = findReferrerByTypeAndArg(graph, shapeDef.ref, "SHAPE_DEFINITION_REPRESENTATION", 0);
  if (!sdRep) return null;
  const repRef = refArg(sdRep.args[1]);
  if (repRef == null) return null;
  return graph.byRef.get(repRef) ?? null;
}

/**
 * Memoised wrapper around {@link computeBrepAabb}. Multi-instance
 * PDs share their geometry — walking the BREP graph once and
 * caching the AABB pays off as soon as the same PD appears twice.
 */
function getLocalAabb(
  ctx: VisitCtx,
  pd:  Entity,
  sr:  Entity | null,
): [number, number, number, number, number, number] | null {

  const cached = ctx.aabbByPd.get(pd.ref);
  if (cached !== undefined) return cached;

  if (!sr) {
    ctx.aabbByPd.set(pd.ref, null);
    return null;
  }
  const aabb = computeBrepAabb(ctx.graph, sr);
  ctx.aabbByPd.set(pd.ref, aabb);
  return aabb;
}

/**
 * Memoised wrapper around {@link tessellateBrep}. Same shape as
 * {@link getLocalAabb} — walking the BREP and triangulating its
 * planar faces is the expensive piece of the load, and a PD used
 * across N occurrences only pays the cost once.
 */
function getLocalGeometry(
  ctx: VisitCtx,
  pd:  Entity,
  sr:  Entity | null,
): TessellatedGeometry | null {

  const cached = ctx.geomByPd.get(pd.ref);
  if (cached !== undefined) return cached;

  if (!sr) {
    ctx.geomByPd.set(pd.ref, null);
    return null;
  }
  const geom = tessellateBrep(ctx.graph, sr);
  ctx.geomByPd.set(pd.ref, geom);
  return geom;
}

/**
 * Walk every BREP-like item in a SHAPE_REPRESENTATION's items list,
 * gather every reachable `CARTESIAN_POINT`, and return the AABB.
 * Returns `null` when the SR carries no BREP-like items at all
 * (typical for purely-instance SRs that only hold a placement +
 * MAPPED_ITEM, where the geometry lives in the source rep).
 *
 * Transitive closure: pushes refs onto a stack and walks any
 * entity's arg tree to find further refs. CARTESIAN_POINT entries
 * contribute their coords to the running min/max; everything else
 * is just a structural node.
 *
 * `visited` keeps the walk linear despite shared sub-entities
 * (e.g. one VERTEX_POINT cited by many EDGE_CURVEs).
 */
function computeBrepAabb(
  graph: InstanceGraph,
  sr:    Entity,
): [number, number, number, number, number, number] | null {

  const items = listArg(sr.args[1]);
  if (!items) return null;

  // Seed the walk only with BREP-like roots — skip
  // AXIS2_PLACEMENT_3D, MAPPED_ITEM, etc., whose CARTESIAN_POINTs
  // are placement origins, not part of the geometry.
  const stack: number[] = [];
  for (const item of items) {
    const ref = refArg(item);
    if (ref == null) continue;
    const e = graph.byRef.get(ref);
    if (!e) continue;
    if (BREP_ROOT_TYPES.has(e.type)) stack.push(ref);
  }
  if (stack.length === 0) return null;

  const visited = new Set<number>();
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let any = false;

  while (stack.length > 0) {
    const ref = stack.pop()!;
    if (visited.has(ref)) continue;
    visited.add(ref);
    const e = graph.byRef.get(ref);
    if (!e) continue;

    if (e.type === "CARTESIAN_POINT") {
      const c = listArg(e.args[1]);
      if (c && c.length >= 3) {
        const x = numArg(c[0]) ?? 0;
        const y = numArg(c[1]) ?? 0;
        const z = numArg(c[2]) ?? 0;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        any = true;
      }
      continue;
    }

    for (const arg of e.args) collectRefsOnto(arg, stack);
  }

  if (!any) return null;
  return [minX, minY, minZ, maxX, maxY, maxZ];
}

/** Top-level item types whose subgraphs we collect points from.
 *  Skips placement / wireframe-only entities (AXIS2_PLACEMENT_3D,
 *  MAPPED_ITEM, GEOMETRIC_REPRESENTATION_CONTEXT, …) so the AABB
 *  reflects geometry, not authoring scaffolding. */
const BREP_ROOT_TYPES: ReadonlySet<string> = new Set([
  "MANIFOLD_SOLID_BREP",
  "BREP_WITH_VOIDS",
  "FACETED_BREP",
  "SHELL_BASED_SURFACE_MODEL",
  "GEOMETRIC_SET",
  "GEOMETRIC_CURVE_SET",
]);

function collectRefsOnto(value: Value, stack: number[]): void {
  switch (value.kind) {
    case "ref":
      stack.push(value.ref);
      return;
    case "list":
      for (const item of value.items) collectRefsOnto(item, stack);
      return;
    case "typed":
      for (const arg of value.args) collectRefsOnto(arg, stack);
      return;
    default:
      return;
  }
}


// ── PRODUCT_DEFINITION ↔ PRODUCT ────────────────────────────────────

/**
 * The PRODUCT this PD ultimately belongs to. PD's `formation` arg
 * (args[2]) refs PRODUCT_DEFINITION_FORMATION; that formation's
 * `of_product` arg (args[2]) refs PRODUCT.
 */
function findProductForPD(graph: InstanceGraph, pd: Entity): Entity | null {
  const formationRef = refArg(pd.args[2]);
  if (formationRef == null) return null;
  const formation = graph.byRef.get(formationRef);
  if (!formation || formation.type !== "PRODUCT_DEFINITION_FORMATION") return null;

  const productRef = refArg(formation.args[2]);
  if (productRef == null) return null;
  const product = graph.byRef.get(productRef);
  if (!product || product.type !== "PRODUCT") return null;
  return product;
}


// ── Placement extraction from a SHAPE_REPRESENTATION's items ────────

/**
 * Scan a SHAPE_REPRESENTATION's items list for the first
 * placement-bearing entity. AXIS2_PLACEMENT_3D goes through
 * directly; MAPPED_ITEM forwards to its mapping_target.
 */
function findFirstPlacementInSRItems(graph: InstanceGraph, sr: Entity): Mat4 | null {
  const items = listArg(sr.args[1]);
  if (!items) return null;
  for (const item of items) {
    const itemRef = refArg(item);
    if (itemRef == null) continue;
    const e = graph.byRef.get(itemRef);
    if (!e) continue;
    if (e.type === "AXIS2_PLACEMENT_3D") {
      return resolveAxis2Placement3D(graph, e);
    }
    if (e.type === "MAPPED_ITEM") {
      // MAPPED_ITEM ('name', mapping_source, mapping_target).
      const targetRef = refArg(e.args[2]);
      if (targetRef == null) continue;
      const target = graph.byRef.get(targetRef);
      if (target && target.type === "AXIS2_PLACEMENT_3D") {
        return resolveAxis2Placement3D(graph, target);
      }
    }
  }
  return null;
}


// ── Assembly transform: NAUO → CDSR → IDT ───────────────────────────

/**
 * Resolve the relative matrix that places this NAUO's child in
 * its parent's coordinate system. Pulls the chain
 * `CDSR → REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION → IDT`
 * and computes `matrix_of(item_2) × inverse(matrix_of(item_1))`.
 */
function resolveAssemblyTransform(graph: InstanceGraph, nauo: Entity): Mat4 | null {
  const cdsr = findReferrerByTypeAndArg(graph, nauo.ref, "CONTEXT_DEPENDENT_SHAPE_REPRESENTATION", 1);
  if (!cdsr) return null;

  const relRef = refArg(cdsr.args[0]);
  if (relRef == null) return null;
  const rel = graph.byRef.get(relRef);
  if (!rel) return null;

  const idtRef = readTransformationOperator(rel);
  if (idtRef == null) return null;

  const idt = graph.byRef.get(idtRef);
  if (!idt) return null;

  // ITEM_DEFINED_TRANSFORMATION
  //   (name, description, transform_item_1, transform_item_2).
  const item1Ref = refArg(idt.args[2]);
  const item2Ref = refArg(idt.args[3]);
  if (item2Ref == null) return null;

  const item2 = graph.byRef.get(item2Ref);
  if (!item2 || item2.type !== "AXIS2_PLACEMENT_3D") return null;
  const mat2 = resolveAxis2Placement3D(graph, item2);
  if (!mat2) return null;

  // item_1 is the source frame the transformation maps *from*. Its
  // matrix's inverse precomposes with item_2 to give the relative
  // placement that takes a coord in the source rep to its place
  // in the destination rep. When item_1 is identity-at-origin (the
  // common case in modelling tools that emit IDT for assembly
  // placement) the inverse is identity and `mat2` alone is correct.
  if (item1Ref == null) return mat2;
  const item1 = graph.byRef.get(item1Ref);
  if (!item1 || item1.type !== "AXIS2_PLACEMENT_3D") return mat2;
  const mat1 = resolveAxis2Placement3D(graph, item1);
  if (!mat1) return mat2;

  // Cheap identity check — skip the inverse when item_1 is
  // already identity. Saves an inverseMat4 + mulMat4 on the hot
  // path of large assemblies.
  if (isIdentityMat4(mat1)) return mat2;

  const inv1 = inverseMat4(mat1, createMat4Float64());
  return mulMat4(mat2, inv1, createMat4Float64());
}

/**
 * Find the `ITEM_DEFINED_TRANSFORMATION` ref carried by a
 * `REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION`. Handles both
 * the simple top-level form and the complex-entity form
 * (`( REP_REL(...) RRWT(...) SR_REL(...) )`).
 */
function readTransformationOperator(rel: Entity): number | undefined {
  if (rel.type === "REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION") {
    // REPRESENTATION_RELATIONSHIP (name, description, rep_1, rep_2)
    // then transformation_operator (single subtype attribute).
    return refArg(rel.args[4]);
  }
  if (rel.type === "") {
    // Complex entity — find the RRWT supertype tuple.
    for (const arg of rel.args) {
      if (arg.kind === "typed" &&
          arg.type === "REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION") {
        return refArg(arg.args[0]);
      }
    }
  }
  return undefined;
}


// ── AXIS2_PLACEMENT_3D → 4×4 matrix ─────────────────────────────────

function resolveAxis2Placement3D(graph: InstanceGraph, placement: Entity): Mat4 | null {
  const locRef    = refArg(placement.args[1]);
  const axisRef   = refArg(placement.args[2]);
  const refDirRef = refArg(placement.args[3]);
  if (locRef == null) return null;

  const location = graph.byRef.get(locRef);
  if (!location || location.type !== "CARTESIAN_POINT") return null;

  const coords = listArg(location.args[1]);
  if (!coords || coords.length < 3) return null;
  const tx = numArg(coords[0]) ?? 0;
  const ty = numArg(coords[1]) ?? 0;
  const tz = numArg(coords[2]) ?? 0;

  // Defaults per ISO 10303-42 §4.4.6.5.
  let zx = 0, zy = 0, zz = 1;
  let rx = 1, ry = 0, rz = 0;

  if (axisRef != null) {
    const axisDir = readDirection(graph, axisRef);
    if (axisDir) { zx = axisDir[0]; zy = axisDir[1]; zz = axisDir[2]; }
  }
  if (refDirRef != null) {
    const refDir = readDirection(graph, refDirRef);
    if (refDir) { rx = refDir[0]; ry = refDir[1]; rz = refDir[2]; }
  }

  // Normalise z.
  const zLen = Math.hypot(zx, zy, zz) || 1;
  zx /= zLen; zy /= zLen; zz /= zLen;

  // Gram-Schmidt: x' = ref - (ref·z) z, then normalise.
  const dot = rx * zx + ry * zy + rz * zz;
  let xx = rx - dot * zx;
  let xy = ry - dot * zy;
  let xz = rz - dot * zz;
  let xLen = Math.hypot(xx, xy, xz);
  if (xLen < 1e-12) {
    if (Math.abs(zx) < 0.9) { xx = 1; xy = 0; xz = 0; }
    else                    { xx = 0; xy = 1; xz = 0; }
    const dot2 = xx * zx + xy * zy + xz * zz;
    xx -= dot2 * zx; xy -= dot2 * zy; xz -= dot2 * zz;
    xLen = Math.hypot(xx, xy, xz) || 1;
  }
  xx /= xLen; xy /= xLen; xz /= xLen;

  // y = z × x.
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  const m = createMat4Float64();
  m[0]  = xx; m[1]  = xy; m[2]  = xz; m[3]  = 0;
  m[4]  = yx; m[5]  = yy; m[6]  = yz; m[7]  = 0;
  m[8]  = zx; m[9]  = zy; m[10] = zz; m[11] = 0;
  m[12] = tx; m[13] = ty; m[14] = tz; m[15] = 1;
  return m;
}

function readDirection(graph: InstanceGraph, ref: number): [number, number, number] | null {
  const e = graph.byRef.get(ref);
  if (!e || e.type !== "DIRECTION") return null;
  const list = listArg(e.args[1]);
  if (!list || list.length < 3) return null;
  return [
    numArg(list[0]) ?? 0,
    numArg(list[1]) ?? 0,
    numArg(list[2]) ?? 0,
  ];
}

/** Quick identity check — shortcuts the inverseMat4+mul on hot paths. */
function isIdentityMat4(m: Mat4): boolean {
  // Diagonal must be 1, off-diagonals near-0. Tolerance is loose
  // because typical IDTs use exact 1.0 / 0.0.
  const eps = 1e-9;
  return (
    Math.abs(m[0]  - 1) < eps && Math.abs(m[5]  - 1) < eps &&
    Math.abs(m[10] - 1) < eps && Math.abs(m[15] - 1) < eps &&
    Math.abs(m[1])  < eps && Math.abs(m[2])  < eps && Math.abs(m[3])  < eps &&
    Math.abs(m[4])  < eps && Math.abs(m[6])  < eps && Math.abs(m[7])  < eps &&
    Math.abs(m[8])  < eps && Math.abs(m[9])  < eps && Math.abs(m[11]) < eps &&
    Math.abs(m[12]) < eps && Math.abs(m[13]) < eps && Math.abs(m[14]) < eps
  );
}


// ── Object-id assignment ────────────────────────────────────────────

/**
 * Walk-order pass: assign each ResolvedProduct a unique
 * `objectId`. PRODUCTs that occur once keep their raw `id`;
 * those used multiple times get suffixed `id#1, id#2, …`.
 */
function assignObjectIds(rs: ResolvedProduct[]): ResolvedProduct[] {
  const counts = new Map<number, number>();
  for (const r of rs) counts.set(r.ref, (counts.get(r.ref) ?? 0) + 1);

  const seen = new Map<number, number>();
  for (const r of rs) {
    const baseId = r.id || `step-${r.ref}`;
    if ((counts.get(r.ref) ?? 0) > 1) {
      const idx = (seen.get(r.ref) ?? 0) + 1;
      seen.set(r.ref, idx);
      r.objectId = `${baseId}#${idx}`;
    } else {
      r.objectId = baseId;
    }
  }
  return rs;
}


// ── Inverse-index helpers ───────────────────────────────────────────

/**
 * Every entity of `type` that references `target` somewhere in
 * its arg tree. Filtered straight from the inverse index, so
 * O(referrers-of-target) — typically a handful per target.
 */
function findReferrersOfType(
  graph:  InstanceGraph,
  target: number,
  type:   string,
): Entity[] {
  const all = graph.referrers.get(target);
  if (!all) return [];
  const out: Entity[] = [];
  for (const e of all) if (e.type === type) out.push(e);
  return out;
}

/**
 * The first entity of `type` whose `argIndex`'th arg is a direct
 * ref to `target`. Stricter than {@link findReferrersOfType} —
 * only matches when the target lives at exactly that arg slot.
 */
function findReferrerByTypeAndArg(
  graph:    InstanceGraph,
  target:   number,
  type:     string,
  argIndex: number,
): Entity | null {
  const all = graph.referrers.get(target);
  if (!all) return null;
  for (const e of all) {
    if (e.type !== type) continue;
    if (argIndex >= e.args.length) continue;
    const arg = e.args[argIndex];
    if (matchesRef(arg, target)) return e;
  }
  return null;
}

function matchesRef(value: Value | undefined, target: number): boolean {
  if (!value) return false;
  if (value.kind === "ref") return value.ref === target;
  return false;
}
