import {type DTXPassRange} from "./dtx/DTXPrimDrawList";
import {DataTexture} from "./dtx/DataTexture";

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
    primToMeshLookup: DataTexture;

    /**
     * Table of mesh attributes.
     */
    meshViewAttribs: DataTexture;

    /**
     * Mapping of rendering passes to their respective primitive ranges in primToMeshLookup.
     * Primitive ranges are used with gl.drawArrays to efficiently render specific passes.
     */
    renderPassDrawRanges: Map<number, DTXPassRange>;

  }[];

  /**
   * Data texture containing unique primitive indices for `gl.drawArrays`.
   */
  indices: DataTexture;

  /**
   * Data texture containing unique edge indices for `gl.drawArrays`.
   */
  edgeIndices: DataTexture;

  /**
   * Data texture containing a table of mesh attributes that are global to all viewManager.
   */
  meshAttribs: DataTexture;

  /**
   * Data texture containing modeling matrices for meshes.
   */
  meshMatrices: DataTexture;

  /**
   * Data texture containing geometry attributes for meshes.
   */
  geometryAttribs: DataTexture;

  /**
   * Data texture containing quantization ranges for geometry decoding.
   */
  geometryQuantRanges: DataTexture;

  /**
   * Data texture containing positions for vertices.
   */
  positions: DataTexture;

  /**
   * Data texture containing RGB colors for vertices.
   */
  vertexColors: DataTexture;
}
