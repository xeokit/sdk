import type {SceneTextureSetRendererProxy} from "./SceneTextureSetRendererProxy";
import type {SceneTexture} from "./SceneTexture";
import type {SceneTextureSetParams} from "./SceneTextureSetParams";

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
   *  Internal interface through which a SceneTextureSet can load property updates into a renderer.
   *
   *  This is defined while the owner {@link SceneModel | SceneModel} has been added to a {@link viewer!Viewer | Viewer}.
   *
   * @internal
   */
  sceneTextureSetRendererProxy: SceneTextureSetRendererProxy | null;

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
    this.sceneTextureSetRendererProxy = null;
  }
}
