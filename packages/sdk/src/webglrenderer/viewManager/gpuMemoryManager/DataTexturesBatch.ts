import {DTXPassRange} from "./dtx/DTXPrimDrawList";

/**
 * Interface representing a collection of data textures used in WebGL rendering.
 *
 * Kept in {@link DataTextures.batches | DataTextures.sortedBatches} array in {@link DataTextures}.
 */
export interface DataTexturesBatch {

  /**
   * Data textures specific to each View.
   */
  views: {

    /**
     * Number of drawable primitives in the batch.
     */
    numDrawablePrims: number;

    /**
     * Data texture mapping each primitive to its corresponding mesh.
     */
    primToMeshLookup: WebGLTexture;

    /**
     * Table of mesh attributes.
     */
    meshViewAttribs: WebGLTexture;

    /**
     * Mapping of rendering passes to their respective primitive ranges in primToMeshLookup.
     * Primitive ranges are used with gl.drawArrays to efficiently render specific passes.
     */
    renderPassDrawRanges: Map<number, DTXPassRange>;

  }[];

  /**
   * Data texture containing unique primitive indices for `gl.drawArrays`.
   */
  indices: WebGLTexture;

  /**
   * Data texture containing unique edge indices for `gl.drawArrays`.
   */
  edgeIndices: WebGLTexture;

  /**
   * Data texture containing a table of mesh attributes that are global to all viewManager.
   */
  meshAttribs: WebGLTexture;

  /**
   * Data texture containing modeling matrices for meshes.
   */
  meshMatrices: WebGLTexture;

  /**
   * Data texture containing geometry attributes for meshes.
   */
  geometryAttribs: WebGLTexture;

  /**
   * Data texture containing quantization ranges for geometry decoding.
   */
  geometryQuantRanges: WebGLTexture;

  /**
   * Data texture containing positions for vertices.
   */
  positions: WebGLTexture;

  /**
   * Data texture containing RGB colors for vertices.
   */
  vertexColors: WebGLTexture;
}
