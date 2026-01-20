/**
 * A mock class representing a shader in WebGLRenderer.
 *
 * The mock shader is logically equivalent to the real shader class used in WebGLRenderer,
 * but does not perform any actual rendering operations. It is primarily used for testing
 * and debugging purposes. Each operation that's done in the shader is simulated to allow
 * for easier verification of rendering logic and CPU-side data organization without drawing anything.
 * This is mainly for verifying the integration and flow of data through the rendering pipeline.
 * Once that's verified, we then know that any remaining problems are likely due to GPU-specific issues.
 */
import {type MemoryView} from "./MemoryView";
import {createVec3Int16, createVec4Float32} from "../../math/vector";
import {transformVec4} from "../../math/matrix";

export class MockShader {

  constructor(public readonly memoryView: MemoryView) {
  }

  /**
   * Simulates the workflow of a vertex shader using the renderer's CPU-side data textures.
   * This method demonstrates how the renderer organizes and accesses GPU-resident data
   * for each draw call, batch, and view. The comments explain the mapping between
   * CPU-side structures and the corresponding shader logic.
   *
   * Logs any inconsistencies in state between the Scene, Viewer and data textures, which
   * would indicate bugs in the renderer's data management.
   */
  public shadeVertex(): void {

    // Example: select a render pass (e.g. OPAQUE)
    const renderPass:number = 0;

    // Access the top-level data textures collection from the renderer
    const dataTextures = this.memoryView.dataTextures;

    // Iterate over all views (e.g. camera, picking, etc.)
    for (let viewIndex = 0; viewIndex < 4; viewIndex++) {

      const tileCameraMatrixTexture = dataTextures.viewTileCameraMatrixTexture[viewIndex];

      // Iterate over all render batches (each batch groups meshes by primitive type)
      for (let batchIndex = 0; batchIndex < dataTextures.batches.length; batchIndex++) {

        // Get the batch's data textures (per-batch, per-view)
        const batchDataTextures = dataTextures.batches[batchIndex];

        // Get the view-dependent textures for this batch and view
        const batchViewDataTextures = batchDataTextures.views[viewIndex];

        // Get the primitive range for the current render pass
        // This defines which primitives to draw for this pass
        const primRange = batchViewDataTextures.renderPassPrimitiveRanges[renderPass];

        // Iterate over all primitives in the current pass's range
        // i.e.  gl.drawArrays(gl.TRIANGLES, primRange.start * 3, primRange.numPrims * 3);

        // TODO: should start at zero for correct simulation
        for (let primIndex = primRange.start; primIndex < primRange.end; primIndex++) { // Each primitive is a triangle
          for (let vertexOffset = 0; vertexOffset < 3; vertexOffset++) { // A, B, C vertices of the triangle

            const vertexIndex = primIndex * 3 + vertexOffset;

            // Lookup the mesh index for this primitive using the primitiveMeshIndexTexture
            // This table maps each primitive to its owning mesh
            const {meshIndex, offset} = batchViewDataTextures.primitiveMeshIndexTexture.getItem(primIndex);

            // TODO: How is offset used?

            // Lookup the SceneMesh using batchIndex and meshIndex
            const sceneMesh = this.memoryView.getMeshAtIndex(batchIndex, meshIndex);

            if (!sceneMesh) {
              console.error("Error: scene mesh not found for mesh index:", meshIndex);
              continue;
            }

            // Lookup mesh attributes (view-invariant) using meshAttributeTexture
            // This includes geometry index, material info, etc.
            const meshAttribs = batchDataTextures.meshAttributeTexture.getItem(meshIndex);

            // const color = meshAttribs.color;
            // const opacity = meshAttribs.opacity;
            //
            // const meshColor = sceneMesh.color;
            // const meshOpacity = sceneMesh.opacity;
            //
            // if (color[0] !== meshColor[0] ||
            //     color[1] !== meshColor[1] ||
            //     color[2] !== meshColor[2]) {
            //   console.error("Error: mesh color mismatch between data textures and scene mesh");
            // }

            // if (opacity !== meshOpacity) {
            //   console.error("Error: mesh opacity mismatch between data textures and scene mesh");
            // }

            // Lookup geometry index for the mesh
            const geometryIndex = meshAttribs.geometryIndex;
            const tileIndex = meshAttribs.tileIndex;

            // Lookup geometry attributes using geometryAttributeTexture
            // This includes base offsets for vertices and indices
            const geometryAttributeTexture = batchDataTextures.geometryAttributeTexture.getItem(geometryIndex);

            const verticesBase = geometryAttributeTexture.verticesBase;
            const indicesBase = geometryAttributeTexture.indicesBase;

            // Lookup index value using indices texture
            // The index is indexed by (indicesBase + vertexIndex)
            const index = batchDataTextures.indexTexture.getItem(indicesBase + offset);

            // Lookup vertex position using vertexPositions texture
            // The position is indexed by the index we just looked up
            const vertexPosition = batchDataTextures.vertexPositionTexture.getItem(verticesBase + index);

            const geometryPosition = createVec3Int16();
            const sceneGeometry = this.memoryView.getGeometryAtIndex(batchIndex, geometryIndex);

            if (!sceneGeometry) {
              console.error("Error: scene geometry not found for geometry index:", geometryIndex);
              continue;
            }

            const geometryPositionsCompressed = sceneGeometry.positionsCompressed;
            geometryPosition[0] = geometryPositionsCompressed[index * 3];
            geometryPosition[1] = geometryPositionsCompressed[index * 3 + 1];
            geometryPosition[2] = geometryPositionsCompressed[index * 3 + 2];

            // Compare the two vertex positions for consistency
            if (vertexPosition[0] !== geometryPosition[0] ||
                vertexPosition[1] !== geometryPosition[1] ||
                vertexPosition[2] !== geometryPosition[2]) {
              console.error("Error: vertex position mismatch between data textures and scene geometry");
            }

            // Lookup view-dependent mesh attributes (e.g. visibility, selection)
            const meshViewAttribs = batchViewDataTextures.meshViewAttributeTexture.getItem(meshIndex);

            const colorize = meshViewAttribs.color;
            const colorizeOpacity = meshViewAttribs.opacity;
            const pickable = meshViewAttribs.pickable;
            const clippable = meshViewAttribs.clippable;

            // if (!isVisible) {
            //   console.error("Error: invisible mesh found in draw list");
            // }

            switch (renderPass) {
              case 0: // OPAQUE
                // if (isSelected || isHighlighted || isXRayed) {
                //   console.error("Error: selected/highlighted/xrayed meshes should not be in OPAQUE pass");
                // }
                break;
              case 1: // TRANSLUCENT
                // if (isSelected || isHighlighted || isXRayed) {
                //   console.error("Error: selected/highlighted/xrayed meshes should not be in TRANSLUCENT pass");
                // }
                break;
              case 2: // SELECTED
                // if (!isSelected) {
                //   console.error("Error: non-selected mesh found in SELECTED pass");
                // }
                break;
              case 3: // HIGHLIGHTED
                // if (!isHighlighted) {
                //   console.error("Error: non-highlighted mesh found in HIGHLIGHTED pass");
                // }
                break;
              case 4: // XRAYED
                // if (!isXRayed) {
                //   console.error("Error: non-xrayed mesh found in XRAYED pass");
                // }
                break;
              default:
                console.error("Error: unknown render pass");
            }

            // Simulate vertex transformation using model and view matrices

            const {matrix: modelMatrix} = batchDataTextures.meshMatrixTexture.getItem(meshIndex);
            const {matrix: viewMatrix} = tileCameraMatrixTexture.getItem(tileIndex);

            const quantizedVertexPos = createVec3Int16();
            quantizedVertexPos[0] = vertexPosition[0];
            quantizedVertexPos[1] = vertexPosition[1];
            quantizedVertexPos[2] = vertexPosition[2];
            quantizedVertexPos[3] = 1.0;

            // Simulate vertex transformation (model-view)

            const modelVertexPos = createVec4Float32();
            const worldVertexPos = createVec4Float32();
            const viewVertexPos = createVec4Float32();

            // Dequantize vertex position

            const quantRange = batchDataTextures.geometryQuantRangeTexture.getItem(geometryIndex);

            modelVertexPos[0] = quantizedVertexPos[0] * quantRange.scale[0] + quantRange.offset[0];
            modelVertexPos[1] = quantizedVertexPos[1] * quantRange.scale[1] + quantRange.offset[1];
            modelVertexPos[2] = quantizedVertexPos[2] * quantRange.scale[2] + quantRange.offset[2];

            // Apply model matrix to get world position

            transformVec4(modelMatrix, modelVertexPos, worldVertexPos);

            // Apply view matrix to get view position

            transformVec4(viewMatrix, worldVertexPos, viewVertexPos);
          }
        }
      }
    }
  }

}

