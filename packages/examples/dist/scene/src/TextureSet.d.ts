import type { Texture } from "./Texture";
import type { TextureSetParams } from "./TextureSetParams";
import type { RendererTextureSet } from "./RendererTextureSet";
/**
 * A set of {@link @xeokit/scene!SceneTexture | Textures} in a {@link @xeokit/scene!SceneModel}.
 *
 * * Stored in {@link @xeokit/scene!SceneModel.textureSets | SceneModel.textureSets}
 * * Created with {@link @xeokit/scene!SceneModel.createTextureSet | SceneModel.createTextureSet}
 * * Referenced by {@link @xeokit/scene!SceneMesh.textureSet | SceneMesh.textureSet}
 *
 * See {@link "@xeokit/scene"} for usage.
 */
export declare class TextureSet {
    /**
     * The ID of this SceneTextureSet.
     */
    id: string;
    /**
     * The color {@link @xeokit/scene!SceneTexture} in this set.
     */
    colorTexture?: Texture;
    /**
     * The metallic-roughness {@link @xeokit/scene!SceneTexture} in this set.
     */
    metallicRoughnessTexture?: Texture;
    /**
     * The occlusion {@link @xeokit/scene!SceneTexture} in this set.
     */
    occlusionTexture?: Texture;
    /**
     * The emissive {@link @xeokit/scene!SceneTexture} in this set.
     */
    emissiveTexture?: Texture;
    /**
     *  Internal interface through which a SceneTextureSet can load property updates into a renderers.
     *
     *  This is defined while the owner {@link @xeokit/scene!SceneModel} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
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
