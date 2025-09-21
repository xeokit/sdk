/**
 * Interface representing a collection of data textures used in WebGL rendering.
 *
 * Kept in {@link DataTextures.layers | DataTextures.layers} array in {@link DataTextures}.
 */
export interface DataTexturesLayer {

  /**
   * Data texture containing unique primitive indices for `gl.drawArrays`.
   */
  indices: WebGLTexture;

  /**
   * Data texture containing unique edge indices for `gl.drawArrays`.
   */
  edgeIndices: WebGLTexture;

  /**
   * Data texture mapping each primitive to its corresponding mesh.
   */
  primToMeshLookup: WebGLTexture;

  /**
   * Data texture containing a table of mesh attributes that are global to all views.
   */
  meshAttribs: WebGLTexture;

  /**
   * Array of data textures, each containing a table of mesh attributes specific to a particular view.
   */
  meshViewAttribs: WebGLTexture[];

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


}
