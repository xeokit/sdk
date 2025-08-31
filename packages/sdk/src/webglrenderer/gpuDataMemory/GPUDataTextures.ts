

export interface GPUDataTextures {

    /**
     * Data texture containing unique primitive indices for `gl.drawArrays`.
     */
    uniqueIndices: WebGLTexture;

    /**
     * Data texture containing unique edge indices for `gl.drawArrays`.
     */
    uniqueEdgeIndices: WebGLTexture;

    /**
     * Data texture mapping each primitive to its corresponding mesh.
     */
    primToMeshLookup: WebGLTexture;

    /**
     * Data texture containing a table of mesh attributes that are global to all views.
     */
    meshAttributes: WebGLTexture;

    /**
     * Array of data textures, each containing a table of mesh attributes specific to a particular view.
     */
    meshViewAttributes: WebGLTexture[];

    /**
     * Data texture containing modeling matrices for meshes.
     */
    meshMatrices: WebGLTexture;

    /**
     * Data texture containing geometry attributes for meshes.
     */
    geometryAttributes: WebGLTexture;

    /**
     * Data texture containing positions for vertices.
     */
    positions: WebGLTexture;

    /**
     * Array of data textures, each containing tile view matrices for specific views.
     */
    tileViewMatrices: WebGLTexture[];
  }
