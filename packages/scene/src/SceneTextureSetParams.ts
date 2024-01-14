/**
 * {@link @xeokit/scene!SceneTextureSet} creation parameters for {@link @xeokit/scene!SceneModel.createTextureSet | SceneModel.createTextureSet}.
 */
export interface SceneTextureSetParams {

    /**
     * ID for the texture set.
     */
    id: string;

    /**
     * ID of a color texture created previously with {@link @xeokit/scene!SceneModel.createTexture}.
     *
     * A color texture has color in *RGB* and alpha in *A*.
     */
    colorTextureId?: string;

    /**
     * ID of a metallic-roughness texture created previously with {@link @xeokit/scene!SceneModel.createTexture}.
     *
     * A metallic-roughness texture has *RGBA* components, with the metallic factor in *R*, and the roughness factor in *G*.
     */
    metallicRoughnessTextureId?: string;

    /**
     * ID of an ambient occlusion texture created previously with {@link @xeokit/scene!SceneModel.createTexture}.
     *
     * An occlusion texture has *RGBA* components, with occlusion factor in *R*,
     */
    occlusionTextureId?: string;

    /**
     * ID of a normal map texture created previously with {@link @xeokit/scene!SceneModel.createTexture}.
     *
     * A normal map texture has *RGBA* components, with the normal map vectors in *RGB*.
     */
    normalsTextureId?: string;

    /**
     * ID of an emissive color texture created previously with {@link @xeokit/scene!SceneModel.createTexture}.
     *
     * An emissive texture has *RGBA* components, with emissive factors in *RGB*.
     */
    emissiveTextureId?: string;
}
