import type { RendererGPUResources } from "../gpuMemoryManager/RendererGPUResources";
import type { SceneGeometry, SceneMesh } from "../../../../../model/scene";
import type { View } from "../../../../viewer";

/**
 * Read-only view of GPU-related memory owned by a {@link WebGLRenderer}.
 * Provides structured, immutable access to the renderer’s GPU-resident data for inspection and debugging.
 *
 * ### Structure
 *
 * The renderer’s data is organized roughly as:
 *
 * - **RendererGPUResources** → a top-level container for GPU resources.
 * - **Batches** → groups of meshes by compatible draw state / primitive type.
 * - **Views** → per-view/per-pass state (eg. camera view, picking, etc.).
 * - **Render passes** → opaque/translucent/style-bin, etc., each with its own draw range.
 *
 * ## Example
 *
 * The example below demonstrates how to:
 *
 * - query a GPU memory usage summary,
 * - access GPU-resident renderer resources through {@link MemoryInspector},
 * - walk batches → views → render passes → primitive ranges,
 * - map GPU indices back to {@link model!scene.SceneMesh | SceneMesh} and geometry instances for correlation,
 * - sanity-check vertex data and simulate parts of the vertex transform path.
 *
 * > Note: This example is intentionally verbose and “inspection oriented”. It is not a recommended
 * > render loop pattern, and it elides some details (eg. certain offsets) that may differ depending
 * > on renderer configuration.
 *
 * ```ts
 * // Get GPU memory usage summary
 * const memoryUsage: MemoryUsage = webglRenderer.getMemoryUsage();
 * console.log(`GPU Memory Usage: ${memoryUsage.usedMB} MB used of ${memoryUsage.totalMB} MB total`);
 *
 * // Get read-only internal view of GPU-resident data
 * const memoryInspector: MemoryInspector = webglRenderer.getMemoryInspector();
 *
 * // Example: select a render pass (e.g. OPAQUE)
 * const renderPass: number = 0;
 *
 * // Access the top-level renderer GPU resource collection
 * const gpuResources = memoryInspector.gpuResources;
 *
 * // Iterate over all views (e.g. camera, picking, etc.)
 * for (let viewIndex = 0; viewIndex < 4; viewIndex++) {
 *
 *   const tileCameraMatrixTexture = gpuResources.viewTileCameraMatrixTexture[viewIndex];
 *
 *   // Iterate over all render batches (each batch groups meshes by primitive type)
 *   for (let batchIndex = 0; batchIndex < gpuResources.batches.length; batchIndex++) {
 *
 *     // Get the batch's GPU resources (per-batch, per-view)
 *     const batchResources = gpuResources.batches[batchIndex];
 *
 *     // Get the view-dependent resources for this batch and view
 *     const batchViewResources = batchResources.views[viewIndex];
 *
 *     // Get the primitive range for the current render pass
 *     // This defines which primitives to draw for this pass
 *     const primRange = batchViewResources.renderPassPrimitiveRanges[renderPass];
 *
 *     // Iterate over all primitives in the current pass's range
 *     // i.e. gl.drawArrays(gl.TRIANGLES, primRange.start * 3, primRange.numPrims * 3);
 *     for (let primIndex = primRange.start; primIndex < primRange.end; primIndex++) { // Each primitive is a triangle
 *       for (let vertexOffset = 0; vertexOffset < 3; vertexOffset++) { // A, B, C vertices of the triangle
 *
 *         const vertexIndex = primIndex * 3 + vertexOffset;
 *
 *         // Lookup the mesh index for this primitive using the primitiveMeshIndexTexture
 *         // This table maps each primitive to its owning mesh
 *         const { meshIndex, offset } = batchViewResources.primitiveMeshIndexTexture.getItem(primIndex);
 *
 *         // Lookup the SceneMesh using batchIndex and meshIndex
 *         const sceneMesh = memoryInspector.getMeshAtIndex(batchIndex, meshIndex);
 *
 *         if (!sceneMesh) {
 *           console.error("Error: scene mesh not found for mesh index:", meshIndex);
 *           continue;
 *         }
 *
 *         // Lookup mesh attributes (view-invariant) using meshAttributeTexture
 *         // This includes geometry index, material info, etc.
 *         const meshAttribs = batchResources.meshAttributeTexture.getItem(meshIndex);
 *
 *         // Lookup geometry index for the mesh
 *         const geometryIndex = meshAttribs.geometryIndex;
 *         const tileIndex = meshAttribs.tileIndex;
 *
 *         // Lookup geometry attributes using geometryAttributeTexture
 *         // This includes base offsets for vertices and indices
 *         const geometryAttributeTexture = batchResources.geometryAttributeTexture.getItem(geometryIndex);
 *
 *         const verticesBase = geometryAttributeTexture.verticesBase;
 *         const indicesBase = geometryAttributeTexture.indicesBase;
 *
 *         // Lookup index value using indices texture
 *         const index = batchResources.indexTexture.getItem(indicesBase + offset);
 *
 *         // Lookup vertex position using vertexPositions texture
 *         const vertexPosition = batchResources.vertexPositionTexture.getItem(verticesBase + index);
 *
 *         const sceneGeometry = memoryInspector.getGeometryAtIndex(batchIndex, geometryIndex);
 *
 *         if (!sceneGeometry) {
 *           console.error("Error: scene geometry not found for geometry index:", geometryIndex);
 *           continue;
 *         }
 *
 *         // Optional: compare against CPU-side compressed positions (if available)
 *         const geometryPositionsCompressed = sceneGeometry.positionsCompressed;
 *         const geometryPosition = createVec3Int16();
 *
 *         geometryPosition[0] = geometryPositionsCompressed[index * 3];
 *         geometryPosition[1] = geometryPositionsCompressed[index * 3 + 1];
 *         geometryPosition[2] = geometryPositionsCompressed[index * 3 + 2];
 *
 *         if (vertexPosition[0] !== geometryPosition[0] ||
 *             vertexPosition[1] !== geometryPosition[1] ||
 *             vertexPosition[2] !== geometryPosition[2]) {
 *           console.error("Error: vertex position mismatch between data textures and scene geometry");
 *         }
 *
 *         // Lookup view-dependent mesh attributes (e.g. visibility and style)
 *         const meshViewAttribs = batchViewResources.meshViewAttributeTexture.getItem(meshIndex);
 *
 *         const colorize = meshViewAttribs.color;
 *         const colorizeOpacity = meshViewAttribs.opacity;
 *         const pickable = meshViewAttribs.pickable;
 *         const clippable = meshViewAttribs.clippable;
 *
 *         switch (renderPass) {
 *           case 0: // OPAQUE
 *             break;
 *           case 1: // TRANSLUCENT
 *             break;
 *           case 2: // STYLE_BIN_OPAQUE
 *             break;
 *           case 3: // STYLE_BIN_TRANSPARENT
 *             break;
 *           default:
 *             console.error("Error: unknown render pass");
 *         }
 *
 *         // Simulate vertex transformation using model and view matrices
 *         const { matrix: modelMatrix } = batchResources.meshMatrixTexture.getItem(meshIndex);
 *         const { matrix: viewMatrix } = tileCameraMatrixTexture.getItem(tileIndex);
 *
 *         // Dequantize vertex position
 *         const quantRange = batchResources.geometryQuantRangeTexture.getItem(geometryIndex);
 *
 *         const modelVertexPos = createVec4Float32();
 *         modelVertexPos[0] = vertexPosition[0] * quantRange.scale[0] + quantRange.offset[0];
 *         modelVertexPos[1] = vertexPosition[1] * quantRange.scale[1] + quantRange.offset[1];
 *         modelVertexPos[2] = vertexPosition[2] * quantRange.scale[2] + quantRange.offset[2];
 *         modelVertexPos[3] = 1.0;
 *
 *         const worldVertexPos = createVec4Float32();
 *         const viewVertexPos = createVec4Float32();
 *
 *         transformVec4(modelMatrix, modelVertexPos, worldVertexPos);
 *         transformVec4(viewMatrix, worldVertexPos, viewVertexPos);
 *       }
 *     }
 *   }
 * }
 * ```
 */
export interface MemoryInspector {

  /**
   * GPU resources used by the renderer (read-only).
   */
  gpuResources: RendererGPUResources;

  /**
   * Backwards-compatible alias for {@link gpuResources}.
   */
  dataTextures: RendererGPUResources;

  /**
   * Gets the {@link viewing!viewer.View | View} registered at the specified index.
   * @param viewIndex Index of the view.
   * @returns The {@link viewing!viewer.View | View} instance or `null` if not found.
   */
  getViewAtIndex(viewIndex: number): View | null;

  /**
   * Gets the {@link model!scene.SceneMesh | SceneMesh} registered at the specified batch and mesh indices.
   * @param batchIndex Index of the render batch.
   * @param meshIndex Index of the mesh within the batch.
   * @returns The {@link model!scene.SceneMesh | SceneMesh} instance or `null` if not found.
   */
  getMeshAtIndex(batchIndex: number, meshIndex: number): SceneMesh | null;

  /**
   * Gets the {@link model!scene.SceneGeometry | SceneGeometry} registered at the specified batch and geometry indices.
   * @param batchIndex Index of the render batch.
   * @param geometryIndex Index of the geometry within the batch.
   * @returns The {@link model!scene.SceneGeometry | SceneGeometry} instance or `null` if not found.
   */
  getGeometryAtIndex(batchIndex: number, geometryIndex: number): SceneGeometry | null;
}
