/**
 * Texture set creation parameters for {@link BuildableModel.createTextureSet}.
 */
export interface TextureSetParams {

    /**
     * ID for the texture set.
     */
    textureSetId: string;

    /**
     * ID of a color texture created previously with {@link BuildableModel.createTexture}.
     *
     * A color texture has color in *RGB* and alpha in *A*.
     */
    colorTextureId?: string;

    /**
     * ID of a metallic-roughness texture created previously with {@link BuildableModel.createTexture}.
     *
     * A metallic-roughness texture has *RGBA* components, with the metallic factor in *R*, and the roughness factor in *G*.
     */
    metallicRoughnessTextureId?: string;

    /**
     * ID of an ambient occlusion texture created previously with {@link BuildableModel.createTexture}.
     *
     * An occlusion texture has *RGBA* components, with occlusion factor in *R*,
     */
    occlusionTextureId?: string;

    /**
     * ID of a normal map texture created previously with {@link BuildableModel.createTexture}.
     *
     * A normal map texture has *RGBA* components, with the normal map vectors in *RGB*.
     */
    normalsTextureId?: string;

    /**
     * ID of an emissive color texture created previously with {@link BuildableModel.createTexture}.
     *
     * An emissive texture has *RGBA* components, with emissive factors in *RGB*.
     */
    emissiveTextureId?: string;
}
