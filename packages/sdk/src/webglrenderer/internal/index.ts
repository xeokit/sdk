/**
 * <img
 *   style="padding-top:20px; padding-bottom:30px; height:100px;"
 *   src="https://xeokit.github.io/sdk/docs/assets/xeokit_webgl_logo.svg"
 * />
 *
 * # xeokit WebGL2 Renderer Internal APIs
 *
 * ---
 *
 * ### *WebGL2-based rendering backend for xeokit Viewers*
 *
 * ---
 *
 * This module provides **diagnostics-only** APIs for inspecting the WebGL2 renderer’s
 * **GPU-resident state**. It is intended for troubleshooting, profiling, and validating
 * renderer behavior (eg. batch layout, draw ranges, and the contents of renderer-managed
 * data textures).
 *
 * These APIs are **read-only**: they do **not** allow mutation of renderer-owned GPU state.
 *
 * ## Diagnostics and tooling
 *
 * The main entry points are:
 *
 * - {@link MemoryUsage} returned by `WebGLRenderer#getMemoryUsage()` for high-level GPU memory stats.
 * - {@link MemoryView} returned by `WebGLRenderer#getMemoryView()` for structured read-only access to
 *   GPU-resident {@link DataTextures}.
 * - Debugger utilities (eg. {@link MemoryDebugger}) for visualizing batches, textures, and draw ranges.
 *
 * ### Mental model
 *
 * The renderer’s data is organized roughly as:
 *
 * - **DataTextures** → a top-level container for GPU tables.
 * - **Batches** → groups of meshes by compatible draw state / primitive type.
 * - **Views** → per-view/per-pass state (eg. camera view, picking, etc.).
 * - **Render passes** → opaque/translucent/selected/highlighted/xrayed, etc., each with its own draw range.
 *
 * ## Example
 *
 * The example below demonstrates how to:
 *
 * - query a GPU memory usage summary,
 * - access GPU-resident data textures through {@link MemoryView},
 * - walk batches → views → render passes → primitive ranges,
 * - map GPU indices back to {@link SceneMesh} and geometry instances for correlation,
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
 * const memoryView: MemoryView = webglRenderer.getMemoryView();
 *
 * // Example: select a render pass (e.g. OPAQUE)
 * const renderPass: number = 0;
 *
 * // Access the top-level data textures collection from the renderer
 * const dataTextures = memoryView.dataTextures;
 *
 * // Iterate over all views (e.g. camera, picking, etc.)
 * for (let viewIndex = 0; viewIndex < 4; viewIndex++) {
 *
 *   const tileCameraMatrixTexture = dataTextures.viewTileCameraMatrixTexture[viewIndex];
 *
 *   // Iterate over all render batches (each batch groups meshes by primitive type)
 *   for (let batchIndex = 0; batchIndex < dataTextures.batches.length; batchIndex++) {
 *
 *     // Get the batch's data textures (per-batch, per-view)
 *     const batchDataTextures = dataTextures.batches[batchIndex];
 *
 *     // Get the view-dependent textures for this batch and view
 *     const batchViewDataTextures = batchDataTextures.views[viewIndex];
 *
 *     // Get the primitive range for the current render pass
 *     // This defines which primitives to draw for this pass
 *     const primRange = batchViewDataTextures.renderPassPrimitiveRanges[renderPass];
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
 *         const { meshIndex, offset } = batchViewDataTextures.primitiveMeshIndexTexture.getItem(primIndex);
 *
 *         // Lookup the SceneMesh using batchIndex and meshIndex
 *         const sceneMesh = memoryView.getMeshAtIndex(batchIndex, meshIndex);
 *
 *         if (!sceneMesh) {
 *           console.error("Error: scene mesh not found for mesh index:", meshIndex);
 *           continue;
 *         }
 *
 *         // Lookup mesh attributes (view-invariant) using meshAttributeTexture
 *         // This includes geometry index, material info, etc.
 *         const meshAttribs = batchDataTextures.meshAttributeTexture.getItem(meshIndex);
 *
 *         // Lookup geometry index for the mesh
 *         const geometryIndex = meshAttribs.geometryIndex;
 *         const tileIndex = meshAttribs.tileIndex;
 *
 *         // Lookup geometry attributes using geometryAttributeTexture
 *         // This includes base offsets for vertices and indices
 *         const geometryAttributeTexture = batchDataTextures.geometryAttributeTexture.getItem(geometryIndex);
 *
 *         const verticesBase = geometryAttributeTexture.verticesBase;
 *         const indicesBase = geometryAttributeTexture.indicesBase;
 *
 *         // Lookup index value using indices texture
 *         const index = batchDataTextures.indexTexture.getItem(indicesBase + offset);
 *
 *         // Lookup vertex position using vertexPositions texture
 *         const vertexPosition = batchDataTextures.vertexPositionTexture.getItem(verticesBase + index);
 *
 *         const sceneGeometry = memoryView.getGeometryAtIndex(batchIndex, geometryIndex);
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
 *         // Lookup view-dependent mesh attributes (e.g. visibility, selection)
 *         const meshViewAttribs = batchViewDataTextures.meshViewAttributeTexture.getItem(meshIndex);
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
 *           case 2: // SELECTED
 *             break;
 *           case 3: // HIGHLIGHTED
 *             break;
 *           case 4: // XRAYED
 *             break;
 *           default:
 *             console.error("Error: unknown render pass");
 *         }
 *
 *         // Simulate vertex transformation using model and view matrices
 *         const { matrix: modelMatrix } = batchDataTextures.meshMatrixTexture.getItem(meshIndex);
 *         const { matrix: viewMatrix } = tileCameraMatrixTexture.getItem(tileIndex);
 *
 *         // Dequantize vertex position
 *         const quantRange = batchDataTextures.geometryQuantRangeTexture.getItem(geometryIndex);
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
 *
 * @module internal
 */

export * as viewManager from "../viewManager";
export * from "./MemoryView";
export * from "./MemoryDebugger";
