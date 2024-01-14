
/**
 * Statistics for a {@link @xeokit/scene!SceneModel}.
 *
 */
export interface SceneModelStats {

    /**
     * The number of {@link @xeokit/scene!SceneObject | SceneObjects} in the {@link @xeokit/scene!SceneModel}.
     */
    numObjects: number;

    /**
     * The number of {@link @xeokit/scene!SceneMesh | Meshes} in the {@link @xeokit/scene!SceneModel}.
     */
    numMeshes: number;

    /**
     * The number of {@link @xeokit/scene!SceneGeometry | Geometries} in the {@link @xeokit/scene!SceneModel}.
     */
    numGeometries: number;

    /**
     * The number of {@link @xeokit/scene!SceneTexture | Textures} in the {@link @xeokit/scene!SceneModel}.
     */
    numTextures: number;

    /**
     * The number of {@link @xeokit/scene!SceneTextureSet | TextureSets} in the {@link @xeokit/scene!SceneModel}.
     */
    numTextureSets: number;

    /**
     * The number of triangles in the {@link @xeokit/scene!SceneModel}.
     */
    numTriangles: number;

    /**
     * The number of lines in the {@link @xeokit/scene!SceneModel}.
     */
    numLines: number;

    /**
     * The number of points primitives in the {@link @xeokit/scene!SceneModel}.
     */
    numPoints: number;

    /**
     * The number of vertices in the {@link @xeokit/scene!SceneModel}.
     */
    numVertices: number;

    /**
     * The number of bytes used for texture storage in the {@link @xeokit/scene!SceneModel}.
     */
    textureBytes: number;
}