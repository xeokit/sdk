import type {SceneTexture} from "./SceneTexture";
import type {SceneTextureSetParams} from "./SceneTextureSetParams";
import type {RendererTextureSet} from "./RendererTextureSet";

/**
 * A set of {@link @xeokit/scene!SceneTexture | Textures} in a {@link @xeokit/scene!SceneModel | SceneModel}.
 *
 * * Stored in {@link @xeokit/scene!SceneModel.textureSets | SceneModel.textureSets}
 * * Created with {@link @xeokit/scene!SceneModel.createTextureSet | SceneModel.createTextureSet}
 * * Referenced by {@link @xeokit/scene!SceneMesh.textureSet | SceneMesh.textureSet}
 *
 * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
 */
export class SceneTextureSet {

    /**
     * The ID of this SceneTextureSet.
     */
    id: string;

    /**
     * The color {@link @xeokit/scene!SceneTexture} in this set.
     */
    colorTexture?: SceneTexture;

    /**
     * The metallic-roughness {@link @xeokit/scene!SceneTexture} in this set.
     */
    metallicRoughnessTexture?: SceneTexture;

    /**
     * The occlusion {@link @xeokit/scene!SceneTexture} in this set.
     */
    occlusionTexture?: SceneTexture;

    /**
     * The emissive {@link @xeokit/scene!SceneTexture} in this set.
     */
    emissiveTexture?: SceneTexture;

    /**
     *  Internal interface through which a SceneTextureSet can load property updates into a renderers.
     *
     *  This is defined while the owner {@link @xeokit/scene!SceneModel | SceneModel} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererTextureSet: RendererTextureSet | null;

    /**
     * @private
     */
    constructor(textureSetParams: SceneTextureSetParams,
                textures: {
                    emissiveTexture?: SceneTexture;
                    occlusionTexture?: SceneTexture;
                    metallicRoughnessTexture?: SceneTexture;
                    colorTexture?: SceneTexture;
                }) {

        this.id = textureSetParams.id;
        this.colorTexture = textures.colorTexture;
        this.metallicRoughnessTexture = textures.metallicRoughnessTexture;
        this.occlusionTexture = textures.occlusionTexture;
        this.emissiveTexture = textures.emissiveTexture;
        this.rendererTextureSet = null;
    }
}
