import type {SceneTexture} from "./SceneTexture";
import type {SceneTextureSetParams} from "./SceneTextureSetParams";
import {SceneModel} from "./SceneModel";
import {SDKErrorType} from "../core";

/**
 * A set of {@link SceneTexture | Textures} in a {@link SceneModel | SceneModel}.
 *
 * * Stored in {@link SceneModel.textureSets | SceneModel.textureSets}
 * * Created with {@link SceneModel.createTextureSet | SceneModel.createTextureSet}
 * * Referenced by {@link SceneMesh.textureSet | SceneMesh.textureSet}
 *
 * See {@link scene | @xeokit/sdk/scene}   for usage.
 */
export class SceneTextureSet {

    /**
     * The ID of this SceneTextureSet.
     */
    id: string;

    /**
     * The color {@link SceneTexture} in this set.
     */
    colorTexture?: SceneTexture;

    /**
     * The metallic-roughness {@link SceneTexture} in this set.
     */
    metallicRoughnessTexture?: SceneTexture;

    /**
     * The occlusion {@link SceneTexture} in this set.
     */
    occlusionTexture?: SceneTexture;

    /**
     * The emissive {@link SceneTexture} in this set.
     */
    emissiveTexture?: SceneTexture;

    /**
     * The {@link SceneModel} that owns this SceneTextureSet.
     * @private
     */
    model: SceneModel;

    /**
     * True if this SceneTextureSet has been destroyed.
     */
    public destroyed: boolean = false;

    /**
     * @private
     */
    constructor(model: SceneModel, textureSetParams: SceneTextureSetParams,
                textures: {
                    emissiveTexture?: SceneTexture;
                    occlusionTexture?: SceneTexture;
                    metallicRoughnessTexture?: SceneTexture;
                    colorTexture?: SceneTexture;
                }) {

        this.model = model;
        this.id = textureSetParams.id;
        this.colorTexture = textures.colorTexture;
        this.metallicRoughnessTexture = textures.metallicRoughnessTexture;
        this.occlusionTexture = textures.occlusionTexture;
        this.emissiveTexture = textures.emissiveTexture;
    }

    /**
     * Destroys this SceneTextureSet.
     */
    destroy(): void {
        if (this.destroyed) {
                 return;
        }
        this.model._destroyTextureSet(this);
        this.destroyed = true;
    }
}
