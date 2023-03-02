import {Texture} from "./Texture";
import {TextureSetParams} from "./TextureSetParams";
import {RendererTextureSet} from "./RendererTextureSet";

/**
 * Represents a set of textures.
 *
 * * Stored in {@link @xeokit/scene!SceneModel.textureSets | SceneModel.textureSets}
 * * Created with {@link @xeokit/scene!SceneModel.createTextureSet | SceneModel.createTextureSet}
 * * Referenced by {@link Mesh.textureSet | Mesh.textureSet}
 *
 * See usage in:
 *
 * * [@xeokit/scene](/docs/modules/_xeokit_scene.html)
 * * [@xeokit/viewer](/docs/modules/_xeokit_viewer.html)
 */
export class TextureSet {

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

    /**
     *  Internal interface through which a TextureSet can load property updates into a renderer.
     *
     *  This is defined while the owner {@link SceneModel} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererTextureSet?: RendererTextureSet;

    /**
     * @private
     */
    constructor(textureSetParams: TextureSetParams,
                textures: {
                    emissiveTexture?: Texture;
                    occlusionTexture?: Texture;
                    metallicRoughnessTexture?: Texture;
                    colorTexture?: Texture;
                }) {

        this.id = textureSetParams.id;
        this.colorTexture = textures.colorTexture;
        this.metallicRoughnessTexture = textures.metallicRoughnessTexture;
        this.occlusionTexture = textures.occlusionTexture;
        this.emissiveTexture = textures.emissiveTexture;
    }
}