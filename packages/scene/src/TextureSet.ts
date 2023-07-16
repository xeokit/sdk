import type {Texture} from "./Texture";
import type {TextureSetParams} from "./TextureSetParams";
import type {RendererTextureSet} from "./RendererTextureSet";

/**
 * A set of {@link @xeokit/scene!Texture | Textures} in a {@link @xeokit/scene!SceneModel}.
 *
 * * Stored in {@link @xeokit/scene!SceneModel.textureSets | SceneModel.textureSets}
 * * Created with {@link @xeokit/scene!SceneModel.createTextureSet | SceneModel.createTextureSet}
 * * Referenced by {@link @xeokit/scene!Mesh.textureSet | Mesh.textureSet}
 *
 * See {@link "@xeokit/scene"} for usage.
 */
export class TextureSet {

    /**
     * The ID of this TextureSet.
     */
    id: string;

    /**
     * The color {@link @xeokit/scene!Texture} in this set.
     */
    colorTexture?: Texture;

    /**
     * The metallic-roughness {@link @xeokit/scene!Texture} in this set.
     */
    metallicRoughnessTexture?: Texture;

    /**
     * The occlusion {@link @xeokit/scene!Texture} in this set.
     */
    occlusionTexture?: Texture;

    /**
     * The emissive {@link @xeokit/scene!Texture} in this set.
     */
    emissiveTexture?: Texture;

    /**
     *  Internal interface through which a TextureSet can load property updates into a renderer.
     *
     *  This is defined while the owner {@link @xeokit/scene!SceneModel} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererTextureSet: RendererTextureSet | null;

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
        this.rendererTextureSet = null;
    }
}