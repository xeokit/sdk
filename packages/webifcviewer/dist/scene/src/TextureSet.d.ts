import type { Texture } from "./Texture";
import type { TextureSetParams } from "./TextureSetParams";
import type { RendererTextureSet } from "./RendererTextureSet";
/**
 * A set of {@link Texture | Textures} in a {@link @xeokit/viewer!Renderer}.
 *
 * * Stored in {@link @xeokit/scene!SceneModel.textureSets | SceneModel.textureSets}
 * * Created with {@link @xeokit/scene!SceneModel.createTextureSet | SceneModel.createTextureSet}
 * * Referenced by {@link @xeokit/scene!Mesh.textureSet | Mesh.textureSet}
 *
 * See {@link "@xeokit/scene"} for usage.
 */
export declare class TextureSet {
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
     *  This is defined while the owner {@link @xeokit/viewer!Renderer} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererTextureSet: RendererTextureSet | null;
    /**
     * @private
     */
    constructor(textureSetParams: TextureSetParams, textures: {
        emissiveTexture?: Texture;
        occlusionTexture?: Texture;
        metallicRoughnessTexture?: Texture;
        colorTexture?: Texture;
    });
}
