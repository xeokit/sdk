import {WebGLAbstractTexture} from "../../webglutils";

export interface GPUDataTextures {

    /**
     * Data texture containing unique primitive indices for `gl.drawArrays`.
     */
    uniqueIndices: WebGLAbstractTexture;

    /**
     * Data texture containing unique edge indices for `gl.drawArrays`.
     */
    uniqueEdgeIndices: WebGLAbstractTexture;

    /**
     * Data texture mapping each primitive to its corresponding mesh.
     */
    primToMeshLookup: WebGLAbstractTexture;

    /**
     * Data texture containing a table of mesh attributes that are global to all views.
     */
    meshAttributes: WebGLAbstractTexture;

    /**
     * Array of data textures, each containing a table of mesh attributes specific to a particular view.
     */
    meshViewAttributes: WebGLAbstractTexture[];

    /**
     * Data texture containing modeling matrices for meshes.
     */
    meshMatrices: WebGLAbstractTexture;

    /**
     * Data texture containing geometry attributes for meshes.
     */
    geometryAttributes: WebGLAbstractTexture;

    /**
     * Data texture containing positions for vertices.
     */
    positions: WebGLAbstractTexture;

    /**
     * Array of data textures, each containing tile view matrices for specific views.
     */
    tileViewMatrices: WebGLAbstractTexture[];
  }
