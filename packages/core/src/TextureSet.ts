import type {Texture} from "./Texture";

/**
 * Represents a set of textures.
 *
 * * Stored in {@link @xeokit/core/components!SceneModel.textureSets | SceneModel.textureSets}
 * * Created with {@link @xeokit/core/components!SceneModel.createTextureSet | SceneModel.createTextureSet}
 * * Referenced by {@link Mesh.textureSet | Mesh.textureSet}
 *
 * See usage in:
 *
 * * [@xeokit/scratchmodel](/docs/modules/_xeokit_scratchmodel.html)
 * * [@xeokit/viewer](/docs/modules/_xeokit_viewer.html)
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