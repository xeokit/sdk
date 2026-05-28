/**
 * # xeokit Spatial
 *
 * Spatial queries against a {@link model!scene.Scene | Scene} — ray,
 * frustum, and AABB intersection plus canvas-position picking with
 * optional snap-to-vertex / snap-to-edge.
 *
 * Members:
 *
 * - {@link collision} — self-maintaining BVH spatial index plus a
 *   triangle-precise raycaster. Ray, frustum, and AABB queries in
 *   `O(log N)`, kept in step with scene mutations.
 * - {@link picking} — unified pick surface routing between the
 *   BVH picker (cheap, filter-aware) and the GPU pick path
 *   (world normals, UVs, snap targets). Same call site for both.
 *
 * Each submodule documents its own quick-start and API on its page.
 *
 * @module spatial
 */
export * as collision from "./collision";
export * as picking from "./picking";
