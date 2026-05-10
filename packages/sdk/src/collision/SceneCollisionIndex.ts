import {
  type AABB3,
  type AABB3Float,
  collapseAABB3,
  containsAABB3,
  createAABB3Float64,
  expandAABB3,
  type Frustum3,
  INSIDE,
  intersectFrustum3AABB3,
  OUTSIDE
} from "../math/boundaries";
import type {Mat4} from "../math/matrix";
import {createVec3Float64, type Vec3, type Vec3Float} from "../math/vector";
import type {Scene, SceneMesh, SceneObject} from "../scene";
import type {SceneCollisionRayHit} from "./SceneCollisionRayHit";
import type {SceneCollisionRayOptions} from "./SceneCollisionRayOptions";
import type {SceneCollisionVisitor} from "./SceneCollisionVisitor";


/**
 * Transforms a local-space AABB into world space using an affine 4x4 matrix
 * (column-major flatten, WebGL convention).
 *
 * Center/extents method: `O(1)`, exact for affine matrices including
 * non-uniform scale, negative scale, rotation, translation, and shear.
 * The transformed extents come from the absolute-valued rotation/scale
 * sub-matrix because mirrored or rotated geometry can flip individual
 * axes — taking abs() collapses every signed contribution into a positive
 * extent regardless of orientation.
 *
 * @internal
 */
function transformAABB3(local: AABB3, matrix: Mat4, out: AABB3Float): AABB3Float {
  const minX = local[0], minY = local[1], minZ = local[2];
  const maxX = local[3], maxY = local[4], maxZ = local[5];

  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const cz = (minZ + maxZ) * 0.5;

  const ex = (maxX - minX) * 0.5;
  const ey = (maxY - minY) * 0.5;
  const ez = (maxZ - minZ) * 0.5;

  const m00 = matrix[0],  m01 = matrix[4],  m02 = matrix[8],  m03 = matrix[12];
  const m10 = matrix[1],  m11 = matrix[5],  m12 = matrix[9],  m13 = matrix[13];
  const m20 = matrix[2],  m21 = matrix[6],  m22 = matrix[10], m23 = matrix[14];

  const wcx = m00 * cx + m01 * cy + m02 * cz + m03;
  const wcy = m10 * cx + m11 * cy + m12 * cz + m13;
  const wcz = m20 * cx + m21 * cy + m22 * cz + m23;

  const wex = Math.abs(m00) * ex + Math.abs(m01) * ey + Math.abs(m02) * ez;
  const wey = Math.abs(m10) * ex + Math.abs(m11) * ey + Math.abs(m12) * ez;
  const wez = Math.abs(m20) * ex + Math.abs(m21) * ey + Math.abs(m22) * ez;

  out[0] = wcx - wex;
  out[1] = wcy - wey;
  out[2] = wcz - wez;
  out[3] = wcx + wex;
  out[4] = wcy + wey;
  out[5] = wcz + wez;
  return out;
}


/**
 * Reusable single-shot scratch buffer for transformed mesh AABBs during
 * object-AABB unioning. Module-private; never read between calls.
 *
 * @internal
 */
const scratchAABB: AABB3Float = createAABB3Float64();


/** @internal */
interface BVHLeaf {
  objectId: string;
  /** World-space AABB of the indexed object, computed at build time. */
  aabb: AABB3Float;
  /** Centroid X — cached for build-time partitioning, never read at query time. */
  cx: number;
  cy: number;
  cz: number;
}


/** @internal */
interface BVHNode {
  /** Tight bound of every descendant. */
  aabb: AABB3Float;
  /** Inner-node children, or `null` when this is a leaf. */
  left: BVHNode | null;
  right: BVHNode | null;
  /** Leaf payload, or `null` when this is an inner node. */
  leaves: BVHLeaf[] | null;
}


/**
 * Number of objects below which a node stops subdividing and becomes a leaf.
 *
 * Picked empirically: small enough that a leaf-level scan is cheap, large
 * enough that we don't pay log-N stack overhead on a half-empty tree. Leaf
 * size 4 also keeps tree depth ≈ log4(N) for typical BIM scenes.
 *
 * @internal
 */
const LEAF_THRESHOLD = 4;


/**
 * Slab-test ray vs an AABB. Writes `tEnter` to `out[0]` and `tExit` to
 * `out[1]` on hit; the contents of `out` are undefined on miss.
 *
 * Inverse direction components (`idx`/`idy`/`idz`) are passed in directly so
 * the divide is paid once per ray, not once per AABB. Negative-zero handling
 * is fine here — `1/-0 = -Infinity` and `1/+0 = Infinity` both produce
 * correctly signed slab bounds, and the `min/max` swap below keeps the
 * tEnter/tExit ordering consistent.
 *
 * @internal
 */
function rayHitsAABB3(
  ox: number, oy: number, oz: number,
  idx: number, idy: number, idz: number,
  aabb: AABB3,
  tMin: number,
  tMax: number,
  out: number[]
): boolean {
  let t1 = (aabb[0] - ox) * idx;
  let t2 = (aabb[3] - ox) * idx;
  let tNear = Math.min(t1, t2);
  let tFar = Math.max(t1, t2);

  t1 = (aabb[1] - oy) * idy;
  t2 = (aabb[4] - oy) * idy;
  tNear = Math.max(tNear, Math.min(t1, t2));
  tFar = Math.min(tFar, Math.max(t1, t2));

  t1 = (aabb[2] - oz) * idz;
  t2 = (aabb[5] - oz) * idz;
  tNear = Math.max(tNear, Math.min(t1, t2));
  tFar = Math.min(tFar, Math.max(t1, t2));

  if (tFar < Math.max(tNear, tMin) || tNear > tMax) {
    return false;
  }

  out[0] = Math.max(tNear, tMin);
  out[1] = Math.min(tFar, tMax);
  return true;
}


/**
 * Cheap "do these AABBs overlap" test. Used by {@link SceneCollisionIndex.forEachInAABB}
 * because the project's `intersectAABB3s` helper currently returns a constant.
 *
 * @internal
 */
function aabbsOverlap(a: AABB3, b: AABB3): boolean {
  return !(
    a[3] < b[0] || a[0] > b[3] ||
    a[4] < b[1] || a[1] > b[4] ||
    a[5] < b[2] || a[2] > b[5]
  );
}


/**
 * Walks every leaf below `node` and emits the object IDs into `cb`.
 * Used by frustum/AABB walks when a node is fully contained in the query
 * volume — no need to test individual leaves.
 *
 * @internal
 */
function emitAllLeaves(node: BVHNode, cb: SceneCollisionVisitor<string>): boolean {
  if (node.leaves) {
    for (let i = 0, n = node.leaves.length; i < n; i++) {
      if (cb(node.leaves[i].objectId) === false) return false;
    }
    return true;
  }
  if (node.left && !emitAllLeaves(node.left, cb)) return false;
  if (node.right && !emitAllLeaves(node.right, cb)) return false;
  return true;
}


/**
 * Spatial index for fast ray, frustum, and AABB queries against a {@link Scene}.
 *
 * Maintains its own per-object world-space AABBs and a hierarchical
 * bounding-volume tree on top, so queries can skip whole branches of the
 * scene at once. Self-contained — no dependency on other index helpers.
 *
 * The index is **lazy and self-maintaining**: any scene mutation (object
 * created, destroyed, or moved; model destroyed) marks the tree dirty, and
 * the next query rebuilds. Build cost is `O(N log N)` and runs at most once
 * between mutations, regardless of how many queries fire after.
 *
 * Why lazy rebuild instead of incremental refit? BIM scenes are typically
 * static once loaded — load triggers a flurry of `onSceneObjectCreated`
 * events, then the tree settles. Lazy rebuild absorbs all of those in a
 * single tree build at the next query, instead of N separate insert/refit
 * passes. For interactive editing of small numbers of objects, query
 * latency stays bounded because rebuild cost scales with object count, not
 * mutation count.
 *
 * Hierarchy strategy: top-down median-centroid split on the longest axis of
 * the parent's AABB. Leaves stop subdividing at `LEAF_THRESHOLD` objects.
 * This is faster to build than a full SAH BVH and queries within ~5–15% of
 * SAH for the typical near-uniform AABB distribution of building models.
 *
 * Queries:
 * - {@link intersectRay} — objects whose world AABB is hit by a ray.
 * - {@link intersectFrustum} — objects inside or straddling a frustum.
 * - {@link intersectAABB} — objects whose world AABB overlaps a query AABB.
 *
 * Each query has a `forEachIn…` streaming variant that takes a visitor
 * callback. Returning `false` from the callback halts iteration — useful for
 * "find first hit" or "any inside?" patterns where you don't want to pay for
 * the full result set.
 */
export class SceneCollisionIndex {

  /** The Scene this index is bound to. */
  public readonly scene: Scene;

  #root: BVHNode | null = null;
  #dirty: boolean = true;
  #unsubscribers: (() => void)[] = [];

  /**
   * Index from object id to its leaf record, populated during build. Lets
   * {@link getObjectAABB} avoid walking the tree for direct lookups.
   *
   * The same `BVHLeaf` objects are referenced from the tree itself, so
   * the AABB stays consistent for both pathways.
   */
  #leafByObjectId: Map<string, BVHLeaf> = new Map();

  /**
   * Per-mesh world-space AABB cache. Lazily populated by
   * {@link getMeshAABB}. Independent of the BVH leaves, since the BVH
   * indexes per-object only.
   */
  #meshAABBs: Map<string, AABB3Float> = new Map();

  /**
   * Set of mesh ids whose cached AABB needs recomputing on next
   * {@link getMeshAABB} call.
   */
  #meshDirty: Set<string> = new Set();

  /**
   * Reusable buffer for {@link getSceneCenter}. Recomputed on demand.
   */
  #sceneCenter: Vec3Float = createVec3Float64();

  /**
   * Creates a SceneCollisionIndex bound to a Scene.
   */
  constructor(scene: Scene) {
    this.scene = scene;

    const invalidateBVH = () => {
      this.#dirty = true;
      this.#root = null;
    };

    this.#unsubscribers.push(

      scene.events.onSceneObjectCreated.subscribe((_, object) => {
        invalidateBVH();
        for (const mesh of object.meshes) {
          this.#meshDirty.add(meshKey(object.id, mesh.id));
        }
      }),

      scene.events.onSceneObjectDestroyed.subscribe((_, object) => {
        invalidateBVH();
        // `SceneModel._destroyObject` nulls every child mesh's
        // `object` back-pointer before dispatching this event, so
        // `mesh.object` is null here. Use the SceneObject we
        // received as the event arg to compose the key — the same
        // way `onSceneObjectCreated` did when it added it.
        for (const mesh of object.meshes) {
          const key = meshKey(object.id, mesh.id);
          this.#meshAABBs.delete(key);
          this.#meshDirty.delete(key);
        }
      }),

      scene.events.onSceneMeshMoved.subscribe((_, mesh) => {
        invalidateBVH();
        if (mesh.object) this.#meshDirty.add(meshKey(mesh.object.id, mesh.id));
      }),

      // Setting `mesh.matrix = X` fires
      // `onSceneMeshMatrixChanged` (not `onSceneMeshMoved`).
      // Without this the BVH stays cached against pre-move
      // AABBs and picking lands on the wrong objects after an
      // exploder run / matrix-driven animation.
      scene.events.onSceneMeshMatrixChanged.subscribe((_, mesh) => {
        invalidateBVH();
        if (mesh.object) this.#meshDirty.add(meshKey(mesh.object.id, mesh.id));
      }),

      scene.events.onSceneModelDestroyed.subscribe((_, model) => {
        invalidateBVH();
        for (const object of Object.values(model.objects) as SceneObject[]) {
          for (const mesh of object.meshes) {
            const key = meshKey(object.id, mesh.id);
            this.#meshAABBs.delete(key);
            this.#meshDirty.delete(key);
          }
        }
      }),
    );
  }

  /**
   * Returns every object whose world AABB is hit by the ray, sorted by
   * `tEnter` ascending (nearest first).
   *
   * For "find first hit" patterns, prefer {@link forEachInRay} — it stops at
   * the caller's discretion and avoids allocating an array.
   *
   * @param origin Ray origin in world space.
   * @param dir Ray direction in world space. Does not need to be normalised
   *   — `tEnter`/`tExit` are returned in `dir`-multiples either way.
   * @param options Optional `tMin`/`tMax` clip bounds (defaults: `0` /
   *   `Infinity`).
   */
  intersectRay(origin: Vec3, dir: Vec3, options?: SceneCollisionRayOptions): SceneCollisionRayHit[] {
    const hits: SceneCollisionRayHit[] = [];
    this.forEachInRay(origin, dir, (hit) => {
      hits.push(hit);
    }, options);
    hits.sort((a, b) => a.tEnter - b.tEnter);
    return hits;
  }

  /**
   * Streams ray hits to a visitor callback. Stops when `cb` returns `false`.
   *
   * Hits are NOT sorted — they're emitted in the BVH's traversal order,
   * which is roughly near-to-far but not guaranteed. If you need strictly
   * sorted hits, use {@link intersectRay} or sort the collected hits
   * yourself.
   */
  forEachInRay(
    origin: Vec3,
    dir: Vec3,
    cb: SceneCollisionVisitor<SceneCollisionRayHit>,
    options?: SceneCollisionRayOptions
  ): void {
    this.#rebuildIfDirty();
    const root = this.#root;
    if (!root) return;

    const ox = origin[0], oy = origin[1], oz = origin[2];
    // Reciprocal direction components — paid once, used per-AABB. Branches
    // inside rayHitsAABB3 cope with -Infinity / +Infinity from a zero
    // component, so we don't special-case axis-aligned rays here.
    const idx = 1 / dir[0];
    const idy = 1 / dir[1];
    const idz = 1 / dir[2];

    const tMin = options?.tMin ?? 0;
    const tMax = options?.tMax ?? Infinity;

    const tBuf = [0, 0];
    const stack: BVHNode[] = [root];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (!rayHitsAABB3(ox, oy, oz, idx, idy, idz, node.aabb, tMin, tMax, tBuf)) {
        continue;
      }
      if (node.leaves) {
        for (let i = 0, n = node.leaves.length; i < n; i++) {
          const leaf = node.leaves[i];
          if (rayHitsAABB3(ox, oy, oz, idx, idy, idz, leaf.aabb, tMin, tMax, tBuf)) {
            if (cb({objectId: leaf.objectId, tEnter: tBuf[0], tExit: tBuf[1]}) === false) {
              return;
            }
          }
        }
      } else {
        if (node.right) stack.push(node.right);
        if (node.left) stack.push(node.left);
      }
    }
  }

  /**
   * Returns every object whose world AABB intersects the given frustum.
   *
   * Skips both fully-outside branches and tests within fully-inside ones —
   * a node entirely inside the frustum has every descendant inside too, so
   * we collect its leaves without per-AABB testing.
   */
  intersectFrustum(frustum: Frustum3): string[] {
    const ids: string[] = [];
    this.forEachInFrustum(frustum, (id) => {
      ids.push(id);
    });
    return ids;
  }

  /**
   * Streams frustum hits to a visitor. Stops when `cb` returns `false`.
   */
  forEachInFrustum(frustum: Frustum3, cb: SceneCollisionVisitor<string>): void {
    this.#rebuildIfDirty();
    const root = this.#root;
    if (!root) return;
    this.#walkFrustum(root, frustum, cb);
  }

  /**
   * Returns every object whose world AABB overlaps the given query AABB.
   *
   * Uses the same inside/intersect/outside fast paths as the frustum walk:
   * if the query AABB fully contains a node's AABB, we collect every leaf
   * below it without further tests.
   */
  intersectAABB(aabb: AABB3): string[] {
    const ids: string[] = [];
    this.forEachInAABB(aabb, (id) => {
      ids.push(id);
    });
    return ids;
  }

  /**
   * Streams AABB hits to a visitor. Stops when `cb` returns `false`.
   */
  forEachInAABB(aabb: AABB3, cb: SceneCollisionVisitor<string>): void {
    this.#rebuildIfDirty();
    const root = this.#root;
    if (!root) return;
    this.#walkAABB(root, aabb, cb);
  }

  /**
   * World-space AABB of the entire indexed scene (the BVH root's bound),
   * or `null` when the scene is empty. Triggers a rebuild if dirty.
   */
  getSceneAABB(): AABB3Float | null {
    this.#rebuildIfDirty();
    return this.#root ? this.#root.aabb : null;
  }

  /**
   * World-space AABB of one indexed object by ID, or `null` when the
   * object isn't in the scene (or has no usable geometry). Lookup is O(1)
   * via the build-time id→leaf index. Triggers a rebuild if dirty.
   */
  getObjectAABB(objectId: string): AABB3Float | null {
    this.#rebuildIfDirty();
    const leaf = this.#leafByObjectId.get(objectId);
    return leaf ? leaf.aabb : null;
  }

  /**
   * Combined world-space AABB of the listed objects, or `null` when none
   * of them are indexed. Triggers a rebuild if dirty.
   *
   * Returns a fresh AABB instance — safe to mutate without affecting
   * cached state.
   */
  getCombinedObjectAABB(objectIds: string[]): AABB3Float | null {
    this.#rebuildIfDirty();
    const out = createAABB3Float64();
    collapseAABB3(out);
    let found = false;
    for (let i = 0, n = objectIds.length; i < n; i++) {
      const leaf = this.#leafByObjectId.get(objectIds[i]);
      if (!leaf) continue;
      expandAABB3(out, leaf.aabb);
      found = true;
    }
    return found ? out : null;
  }

  /**
   * World-space AABB of one indexed mesh. Lazily computed and cached;
   * recomputed on the next call after the mesh moves or its matrix is
   * changed.
   *
   * Independent of the BVH — does not trigger a tree rebuild.
   *
   * @param mesh The mesh to query.
   * @returns The mesh's world-space AABB. The returned buffer is owned
   *   by the index; do not mutate.
   */
  getMeshAABB(mesh: SceneMesh): AABB3Float {
    const key = mesh.object ? meshKey(mesh.object.id, mesh.id) : `<orphan>-${mesh.id}`;
    let aabb = this.#meshAABBs.get(key);
    if (!aabb) {
      aabb = createAABB3Float64();
      this.#meshAABBs.set(key, aabb);
      this.#meshDirty.add(key);
    }
    if (this.#meshDirty.has(key)) {
      transformAABB3(mesh.geometry.aabb, mesh.worldMatrix, aabb);
      this.#meshDirty.delete(key);
    }
    return aabb;
  }

  /**
   * World-space center of the entire indexed scene's AABB. Triggers a
   * BVH rebuild if dirty. Returns the zero vector when the scene is
   * empty.
   *
   * The returned buffer is owned by the index; do not mutate.
   */
  getSceneCenter(): Vec3Float {
    const aabb = this.getSceneAABB();
    if (!aabb) {
      this.#sceneCenter[0] = 0;
      this.#sceneCenter[1] = 0;
      this.#sceneCenter[2] = 0;
      return this.#sceneCenter;
    }
    this.#sceneCenter[0] = (aabb[0] + aabb[3]) * 0.5;
    this.#sceneCenter[1] = (aabb[1] + aabb[4]) * 0.5;
    this.#sceneCenter[2] = (aabb[2] + aabb[5]) * 0.5;
    return this.#sceneCenter;
  }

  /**
   * Forces an immediate rebuild of the BVH. Normally callers don't need
   * this — the next query rebuilds automatically — but it's useful in
   * benchmarking and in the rare case where you want to amortise build cost
   * outside the query path.
   */
  rebuild(): void {
    this.#dirty = true;
    this.#rebuildIfDirty();
  }

  /**
   * Number of objects currently indexed. Triggers a rebuild if dirty.
   */
  get size(): number {
    this.#rebuildIfDirty();
    return countLeaves(this.#root);
  }

  /**
   * Tears down event subscriptions and releases the BVH plus the
   * per-mesh AABB cache.
   */
  destroy(): void {
    for (const unsubscribe of this.#unsubscribers) {
      unsubscribe();
    }
    this.#unsubscribers.length = 0;
    this.#root = null;
    this.#leafByObjectId.clear();
    this.#meshAABBs.clear();
    this.#meshDirty.clear();
    this.#dirty = true;
  }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  #walkFrustum(node: BVHNode, frustum: Frustum3, cb: SceneCollisionVisitor<string>): boolean {
    const state = intersectFrustum3AABB3(frustum, node.aabb);
    if (state === OUTSIDE) return true;
    if (state === INSIDE) {
      // Whole subtree is inside — emit every leaf without per-AABB testing.
      return emitAllLeaves(node, cb);
    }
    // INTERSECT — descend.
    if (node.leaves) {
      for (let i = 0, n = node.leaves.length; i < n; i++) {
        const leaf = node.leaves[i];
        if (intersectFrustum3AABB3(frustum, leaf.aabb) !== OUTSIDE) {
          if (cb(leaf.objectId) === false) return false;
        }
      }
      return true;
    }
    if (node.left && !this.#walkFrustum(node.left, frustum, cb)) return false;
    if (node.right && !this.#walkFrustum(node.right, frustum, cb)) return false;
    return true;
  }

  #walkAABB(node: BVHNode, query: AABB3, cb: SceneCollisionVisitor<string>): boolean {
    if (!aabbsOverlap(node.aabb, query)) return true;
    if (containsAABB3(query, node.aabb)) {
      // Query AABB swallows this node's AABB whole — every descendant qualifies.
      return emitAllLeaves(node, cb);
    }
    if (node.leaves) {
      for (let i = 0, n = node.leaves.length; i < n; i++) {
        const leaf = node.leaves[i];
        if (aabbsOverlap(leaf.aabb, query)) {
          if (cb(leaf.objectId) === false) return false;
        }
      }
      return true;
    }
    if (node.left && !this.#walkAABB(node.left, query, cb)) return false;
    if (node.right && !this.#walkAABB(node.right, query, cb)) return false;
    return true;
  }

  #rebuildIfDirty(): void {
    if (!this.#dirty) return;
    this.#dirty = false;
    this.#leafByObjectId.clear();

    const leaves: BVHLeaf[] = [];
    const objects = this.scene.objects;
    for (const id in objects) {
      const aabb = createAABB3Float64();
      if (!this.#computeObjectAABB(objects[id], aabb)) continue;
      const leaf: BVHLeaf = {
        objectId: id,
        aabb,
        cx: (aabb[0] + aabb[3]) * 0.5,
        cy: (aabb[1] + aabb[4]) * 0.5,
        cz: (aabb[2] + aabb[5]) * 0.5
      };
      leaves.push(leaf);
      // Same leaf reference goes into both the tree and the lookup map,
      // so getObjectAABB returns the exact AABB the BVH is querying with.
      this.#leafByObjectId.set(id, leaf);
    }

    this.#root = leaves.length === 0 ? null : this.#build(leaves);
  }

  /**
   * Computes the world-space AABB of a SceneObject by unioning each mesh's
   * local AABB transformed by its world matrix.
   *
   * Returns `false` (and leaves `out` collapsed) when the object has no
   * meshes or no usable geometry — caller skips it instead of inserting an
   * empty leaf that would poison the parent bound.
   *
   * @internal
   */
  #computeObjectAABB(object: SceneObject, out: AABB3Float): boolean {
    collapseAABB3(out);
    let found = false;
    const meshes = object.meshes;
    for (let i = 0, n = meshes.length; i < n; i++) {
      const mesh = meshes[i];
      const geom = mesh.geometry;
      if (!geom) continue;
      transformAABB3(geom.aabb, mesh.worldMatrix, scratchAABB);
      expandAABB3(out, scratchAABB);
      found = true;
    }
    return found;
  }

  #build(items: BVHLeaf[]): BVHNode {
    // Single index allocation reused for the entire recursion. All
    // partitioning happens in place inside this Int32Array — the recursion
    // never slices the items array, and `idx` is the only build-time
    // allocation that scales with N.
    const idx = new Int32Array(items.length);
    for (let i = 0; i < items.length; i++) idx[i] = i;
    return this.#buildRange(items, idx, 0, items.length);
  }

  #buildRange(items: BVHLeaf[], idx: Int32Array<any>, lo: number, hi: number): BVHNode {
    const aabb = createAABB3Float64();
    collapseAABB3(aabb);
    for (let i = lo; i < hi; i++) {
      expandAABB3(aabb, items[idx[i]].aabb);
    }

    const count = hi - lo;
    if (count <= LEAF_THRESHOLD) {
      const leaves: BVHLeaf[] = new Array(count);
      for (let i = 0; i < count; i++) leaves[i] = items[idx[lo + i]];
      return {aabb, left: null, right: null, leaves};
    }

    // Split on the longest axis of the parent volume.
    const dx = aabb[3] - aabb[0];
    const dy = aabb[4] - aabb[1];
    const dz = aabb[5] - aabb[2];
    const axis: 0 | 1 | 2 = (dx >= dy && dx >= dz) ? 0 : (dy >= dz ? 1 : 2);

    // Quickselect partitions idx[lo..hi] in O(count) so idx[mid] sits at the
    // centroid median on the chosen axis — sub-ranges aren't fully sorted,
    // but the BVH only cares about the split point. Replaces the previous
    // Array.sort, which made build cost O(N log² N).
    const mid = lo + (count >> 1);
    nthElementByCentroid(items, idx, lo, hi, mid, axis);

    return {
      aabb,
      left: this.#buildRange(items, idx, lo, mid),
      right: this.#buildRange(items, idx, mid, hi),
      leaves: null
    };
  }
}


/**
 * Returns the centroid coordinate of `leaf` along `axis` (0 = x, 1 = y, 2 = z).
 *
 * @internal
 */
function centroidOnAxis(leaf: BVHLeaf, axis: 0 | 1 | 2): number {
  return axis === 0 ? leaf.cx : axis === 1 ? leaf.cy : leaf.cz;
}


/**
 * Quickselect with median-of-three pivoting. Partitions `idx[lo..hi]`
 * (exclusive `hi`) so that after the call:
 *
 *   - every entry in `idx[lo..n]` has a centroid <= idx[n]'s
 *   - every entry in `idx[n..hi]` has a centroid >= idx[n]'s
 *
 * Average `O(count)`, worst `O(count²)` on adversarial inputs — median-of-three
 * pivots make adversarial cases vanishingly rare for the centroid
 * distributions we get from real scenes.
 *
 * In-place: only swaps entries inside `idx`. No allocations.
 *
 * @internal
 */
function nthElementByCentroid(
  items: BVHLeaf[],
  idx: Int32Array<any>,
  lo: number,
  hi: number,
  n: number,
  axis: 0 | 1 | 2
): void {
  while (hi - lo > 1) {
    const last = hi - 1;
    const mid = (lo + last) >> 1;
    const va = centroidOnAxis(items[idx[lo]], axis);
    const vb = centroidOnAxis(items[idx[mid]], axis);
    const vc = centroidOnAxis(items[idx[last]], axis);
    // Pick the index whose value is the median of {a, b, c}.
    let pivotIdx: number;
    if ((va <= vb && vb <= vc) || (vc <= vb && vb <= va)) pivotIdx = mid;
    else if ((vb <= va && va <= vc) || (vc <= va && va <= vb)) pivotIdx = lo;
    else pivotIdx = last;

    // Move pivot to the end so the partition loop is a single linear pass.
    let tmp = idx[pivotIdx];
    idx[pivotIdx] = idx[last];
    idx[last] = tmp;
    const pivotVal = centroidOnAxis(items[idx[last]], axis);

    // Lomuto partition: everything < pivotVal slides to the front of the range.
    let store = lo;
    for (let i = lo; i < last; i++) {
      if (centroidOnAxis(items[idx[i]], axis) < pivotVal) {
        tmp = idx[i];
        idx[i] = idx[store];
        idx[store] = tmp;
        store++;
      }
    }
    // Pivot lands at `store`.
    tmp = idx[store];
    idx[store] = idx[last];
    idx[last] = tmp;

    if (n < store) hi = store;
    else if (n > store) lo = store + 1;
    else return;
  }
}


/** @internal */
function countLeaves(node: BVHNode | null): number {
  if (!node) return 0;
  if (node.leaves) return node.leaves.length;
  return countLeaves(node.left) + countLeaves(node.right);
}

/**
 * Composite key for {@link SceneCollisionIndex.getMeshAABB} cache
 * entries. Mesh ids are unique within a SceneObject but may repeat
 * across objects, so the owning object's id is mixed in.
 *
 * @internal
 */
function meshKey(objectId: string, meshId: string): string {
  return `${objectId}-${meshId}`;
}
