import type {Texture} from "./Texture";

/**
 * Represents a set of textures.
 *
 * * Stored in {@link Model.textureSets}
 * * Created with {@link BuildableModel.createTextureSet}
 * * Referenced by {@link Mesh.textureSet}
 */
export interface TextureSet {

    /**
     * The ID of this TextureSet.
     */
    id: string;

    /**
     * The color {@link Texture} in this set.
     */
    colorTexture?: Texture;

    /**
     * The metallic-roughness {@link Texture} in this set.
     */
    metallicRoughnessTexture?: Texture;

    /**
     * The occlusion {@link Texture} in this set.
     */
    occlusionTexture?: Texture;

    /**
     * The emissive {@link Texture} in this set.
     */
    emissiveTexture?: Texture;
}