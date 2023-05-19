
/**
 * Statistics for a {@link SceneModel}.
 *
 */
export interface SceneModelStats {

    /**
     * The number of {@link SceneObject | SceneObjects} in the {@link SceneModel}.
     */
    numObjects: number;

    /**
     * The number of {@link Mesh | Meshes} in the {@link SceneModel}.
     */
    numMeshes: number;

    /**
     * The number of {@link Geometry | Geometries} in the {@link SceneModel}.
     */
    numGeometries: number;

    /**
     * The number of {@link Texture | Textures} in the {@link SceneModel}.
     */
    numTextures: number;

    /**
     * The number of {@link TextureSet | TextureSets} in the {@link SceneModel}.
     */
    numTextureSets: number;

    /**
     * The number of triangles in the {@link SceneModel}.
     */
    numTriangles: number;

    /**
     * The number of lines in the {@link SceneModel}.
     */
    numLines: number;

    /**
     * The number of points primitives in the {@link SceneModel}.
     */
    numPoints: number;

    /**
     * The number of vertices in the {@link SceneModel}.
     */
    numVertices: number;

    /**
     * The number of bytes used for texture storage in the {@link SceneModel}.
     */
    textureBytes: number;
}