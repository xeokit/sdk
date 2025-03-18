/**
 * A set of {@link scene!SceneTexture | Textures} in a {@link scene!SceneModel | SceneModel}.
 *
 * * Stored in {@link scene!SceneModel.textureSets | SceneModel.textureSets}
 * * Created with {@link scene!SceneModel.createTextureSet | SceneModel.createTextureSet}
 * * Referenced by {@link scene!SceneMesh.textureSet | SceneMesh.textureSet}
 *
 * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
 */
export class SceneTextureSet {
    /**
     * The ID of this SceneTextureSet.
     */
    id;
    /**
     * The color {@link scene!SceneTexture} in this set.
     */
    colorTexture;
    /**
     * The metallic-roughness {@link scene!SceneTexture} in this set.
     */
    metallicRoughnessTexture;
    /**
     * The occlusion {@link scene!SceneTexture} in this set.
     */
    occlusionTexture;
    /**
     * The emissive {@link scene!SceneTexture} in this set.
     */
    emissiveTexture;
    /**
     *  Internal interface through which a SceneTextureSet can load property updates into a renderers.
     *
     *  This is defined while the owner {@link scene!SceneModel | SceneModel} has been added to a {@link viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererTextureSet;
    /**
     * @private
     */
    constructor(textureSetParams, textures) {
        this.id = textureSetParams.id;
        this.colorTexture = textures.colorTexture;
        this.metallicRoughnessTexture = textures.metallicRoughnessTexture;
        this.occlusionTexture = textures.occlusionTexture;
        this.emissiveTexture = textures.emissiveTexture;
        this.rendererTextureSet = null;
    }
}
//# sourceMappingURL=SceneTextureSet.js.map