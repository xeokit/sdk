/**
 * # Filled-Polygon Extraction
 *
 * Per-source-object filled silhouette extraction for the drawings
 * pipeline. Uses the `hle` depth buffer so fill boundaries align with
 * the projected wireframe.
 *
 * Derives one {@link FillPolygons} record per source
 * {@link model!scene.SceneMesh | SceneMesh} that contributed at least one
 * frontmost pixel to the depth buffer's owner field. Each record carries
 * flat world-space `positions` and `indices` that can be passed to
 * {@link model!scene.SceneModel.createGeometry | SceneModel.createGeometry}.
 *
 * Internally the extractor:
 *
 *  1. **Histograms** owner pixels to skip empties.
 *  2. **Marching-squares-traces** each owner's visibility mask into
 *     closed contours.
 *  3. **Simplifies** the contour via Douglas-Peucker (default ε = 0.25 px).
 *  4. **Triangulates** the simplified polygon with earcut.
 *  5. **Lifts** the 2D vertices back to world space on the projection plane.
 *
 * Wireframe edges and fills derive from the same depth buffer, so their
 * boundaries use the same visibility result.
 *
 * <br>
 *
 * ## Entry points
 *
 * Two extractors return the same shape. Pick by memory budget:
 *
 * - {@link extractFills} — consumes an already-built
 *   `HLEDepthBuffer` (from the sibling `hle` submodule) and
 *   triangulates each owner's mask in-memory. Use it when the projection
 *   already has a depth buffer.
 * - {@link extractFillsTiled} — rasterises tile-at-a-time so peak memory
 *   stays bounded at `O(tileSize²)` rather than `O(resolution²)`. Used by
 *   the projector at high resolutions on dense scenes.
 *
 * <br>
 *
 * ## Usage
 *
 * ### From an existing depth buffer
 *
 * ```javascript
 * import { buildHLEDepthBuffer } from "../libs/presentations/dist/index.js";
 * import { extractFills }        from "../libs/presentations/dist/index.js";
 *
 * const buffer = await buildHLEDepthBuffer(sourceModel, basis, aabb, {
 *   resolution: 2048,
 *   withOwners: true                 // required for fill extraction
 * });
 *
 * const planeDepth = -aabb[1];       // basis-d of the projection plane
 *
 * const fills = extractFills(buffer, planeDepth, {
 *   minPixelArea:    4,
 *   simplifyEpsilon: 0.25
 * });
 *
 * for (const { sourceObjectId, sourceMeshId, positions, indices } of fills) {
 *   // Emit one TrianglesPrimitive geometry per source mesh.
 * }
 * ```
 *
 * ### Tile-at-a-time, bounded memory
 *
 * For high-resolution drawings on large source models, the tiled
 * extractor walks the projection plane in `tileSize × tileSize` chunks.
 * Peak memory stays `O(tileSize²)` regardless of `resolution`.
 *
 * ```javascript
 * import { extractFillsTiled } from "../libs/presentations/dist/index.js";
 * import { getSceneCollisionIndex } from "@xeokit/sdk/spatial/collision";
 *
 * const fills = await extractFillsTiled({
 *   sourceModel,
 *   basis,
 *   aabb,
 *   planeDepth,
 *   resolution:     4096,
 *   tileSize:       1024,
 *   collisionIndex: getSceneCollisionIndex(scene),
 *   minPixelArea:    4,
 *   simplifyEpsilon: 0.25,
 *   yield: () => new Promise(resolve =>
 *     requestAnimationFrame(() => resolve())
 *   )
 * });
 * ```
 *
 * Passing a {@link spatial!collision.SceneCollisionIndex | SceneCollisionIndex}
 * narrows the per-tile candidate set from `O(N × T)` to `O(log N × T)`.
 * This is usually worth it once `N` (source SceneObjects) crosses ~1000.
 *
 * <br>
 *
 * ## Picking a tile size
 *
 * - **`tileSize = 1024`** (default) — bounds peak memory at ~16 MB.
 * - **`tileSize = 512`** — bounds peak memory at ~4 MB.
 * - **`tileSize = 0`** (or `>= resolution`) — disables tiling and uses a
 *   single buffer. Use for small models where per-tile overhead is not useful.
 *
 * @module fills
 */
export * from "./FillPolygons";
export * from "./FillSpec";
export * from "./ExtractFillsOptions";
export * from "./ExtractFillsTiledParams";
export * from "./extractFills";
export * from "./extractFillsTiled";
