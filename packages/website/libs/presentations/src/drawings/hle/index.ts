/**
 * # Hidden-Line Elimination
 *
 * CPU-side orthographic depth-buffer rasterisation and edge visibility
 * tests for the drawings pipeline.
 *
 * Rasterises source {@link model!scene.SceneModel | SceneModel} triangles
 * into an orthographic {@link HLEDepthBuffer} along an arbitrary
 * {@link ProjectionBasis | projection basis}. Downstream stages use the
 * resulting point and edge tests to drop occluded geometry.
 *
 * The depth buffer carries "distance-toward-camera" values in row-major
 * pixel order. When built with `withOwners: true`, it also carries a
 * parallel per-pixel owner buffer that maps every frontmost pixel back
 * to the {@link model!scene.SceneMesh | SceneMesh} that produced it; the
 * sibling `fills` extractor reads this owner buffer to trace
 * per-object silhouettes.
 *
 * <br>
 *
 * ## Entry points
 *
 * - {@link buildHLEDepthBuffer} — rasterise the source model into a
 *   depth buffer (and optionally an owner buffer).
 * - {@link isPointVisible} — test a single world-space point against
 *   the buffer.
 * - {@link visibleEdgeSegments} — sample an edge and return its
 *   visible sub-segments as world-space endpoint pairs.
 *
 * <br>
 *
 * ## Usage
 *
 * {@link buildDrawing} calls this internally. Use it directly when custom
 * annotation or overlay geometry needs the same visibility test.
 *
 * ```javascript
 * import {
 *   buildHLEDepthBuffer,
 *   visibleEdgeSegments
 * } from "../libs/presentations/dist/index.js";
 *
 * // Top-down basis: looking along -Y, +X reads as right, -Z as up.
 * const basis = {
 *   right:   [1,  0,  0],
 *   up:      [0,  0, -1],
 *   forward: [0, -1,  0]
 * };
 *
 * const sourceModel = scene.models["myModel"];
 * const aabb        = sourceModel.aabb;
 *
 * const buffer = await buildHLEDepthBuffer(sourceModel, basis, aabb, {
 *   resolution:  2048,
 *   withOwners:  false
 * });
 *
 * // Test an annotation line for visibility against the model.
 * const segments = visibleEdgeSegments(
 *   buffer,
 *   [ 10, 5,  0 ],  // edge start
 *   [ 10, 5, 20 ],  // edge end
 *   8,              // sample count
 *   0.01            // depth-bias tolerance (world units)
 * );
 *
 * for (const { a, b } of segments) {
 *   // Emit each visible sub-segment as a LinesPrimitive geometry.
 * }
 * ```
 *
 * <br>
 *
 * ## Resolution and memory
 *
 * Buffer memory is `4 × width × height` bytes (Float32 depths) plus an
 * equal-size Int32 owner buffer when `withOwners: true`. At the default
 * 2048-pixel longer axis, peak memory is ~16 MB for the depth buffer
 * and another ~16 MB for owners. For high-resolution drawings on dense
 * models, use the tile-at-a-time `fills` extractor to keep peak memory
 * bounded
 * at `O(tileSize²)` regardless of `resolution`.
 *
 * @module hle
 */
export * from "./HLEDepthBuffer";
export * from "./HLEOptions";
export * from "./BuildHLEDepthBufferOptions";
export * from "./computeHLE";
