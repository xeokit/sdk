/**
 * Statistics for a {@link SceneModel | SceneModel}.
 *
 */
export interface SceneModelStats {

  /**
   * The number of {@link SceneObject | SceneObjects} in the {@link SceneModel | SceneModel}.
   */
  numObjects: number;

  /**
   * The number of {@link SceneMesh | Meshes} in the {@link SceneModel | SceneModel}.
   */
  numMeshes: number;

  /**
   * The number of {@link SceneGeometry | Geometries} in the {@link SceneModel | SceneModel}.
   */
  numGeometries: number;

  /**
   * The number of {@link SceneTexture | Textures} in the {@link SceneModel | SceneModel}.
   */
  numTextures: number;

  /**
   * The number of {@link SceneTextureSet | TextureSets} in the {@link SceneModel | SceneModel}.
   */
  numTextureSets: number;

  /**
   * The number of triangles in the {@link SceneModel | SceneModel}.
   */
  numTriangles: number;

  /**
   * The number of lines in the {@link SceneModel | SceneModel}.
   */
  numLines: number;

  /**
   * The number of points primitives in the {@link SceneModel | SceneModel}.
   */
  numPoints: number;

  /**
   * The number of vertices in the {@link SceneModel | SceneModel}.
   */
  numVertices: number;

  /**
   * The number of bytes used for texture storage in the {@link SceneModel | SceneModel}.
   */
  textureBytes: number;
}
