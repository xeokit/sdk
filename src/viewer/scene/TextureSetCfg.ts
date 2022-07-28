/**
 * Texture set creation parameters for {@link SceneModel.createTextureSet}.
 */
export interface TextureSetCfg {

    /**
     * ID for the texture set.
     */
    id: string;

    /**
     * ID of a color texture created previously with {@link SceneModel.createTexture}.
     */
    colorTextureId?: string;

    /**
     * ID of a metallic-roughness texture created previously with {@link SceneModel.createTexture}.
     */
    metallicRoughnessTextureId?: string;

    /**
     * ID of an ambient occlusion texture created previously with {@link SceneModel.createTexture}.
     */
    occlusionTextureId?: string;

    /**
     * ID of a normal map texture created previously with {@link SceneModel.createTexture}.
     */
    normalsTextureId?: string;

    /**
     * ID of an emissive color texture created previously with {@link SceneModel.createTexture}.
     */
    emissiveTextureId?: string;
}