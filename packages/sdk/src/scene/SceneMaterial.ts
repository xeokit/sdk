import type {SceneTexture} from "./SceneTexture";
import type {SceneMaterialParams} from "./SceneMaterialParams";
import type {SceneModel} from "./SceneModel";
import {createVec3Float32, type Vec3} from "../math/vector";
import {SDKErrorType, type SDKResult} from "../core";

/**
 * A set of {@link SceneTexture | Textures} in a {@link SceneModel | SceneModel}.
 *
 * * Stored in {@link SceneModel.materials | SceneModel.materials}
 * * Created with {@link SceneModel.createMaterial | SceneModel.createMaterial}
 * * Referenced by {@link SceneMaterial.material | SceneMaterial.material}
 *
 * See {@link scene | @xeokit/sdk/scene}   for usage.
 */
export class SceneMaterial {

  /**
   * The {@link SceneModel} that owns this SceneMaterial.
   * @private
   */
  model: SceneModel;

  /**
   * The ID of this SceneMaterial.
   */
  id: string;

  _color: Vec3;

  _opacity: number;

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
   * True if this SceneMaterial has been destroyed.
   */
  public destroyed: boolean = false;

  /**
   * @private
   */
  constructor(model: SceneModel, materialParams: SceneMaterialParams,
              textures: {
                emissiveTexture?: SceneTexture;
                occlusionTexture?: SceneTexture;
                metallicRoughnessTexture?: SceneTexture;
                colorTexture?: SceneTexture;
              }) {

    this.model = model;
    this.id = materialParams.id;
    this._color = createVec3Float32(materialParams.color || [1, 1, 1]);
    this._opacity = (materialParams.opacity !== undefined && materialParams.opacity !== null) ? materialParams.opacity : 1.0;
    this.colorTexture = textures.colorTexture;
    this.metallicRoughnessTexture = textures.metallicRoughnessTexture;
    this.occlusionTexture = textures.occlusionTexture;
    this.emissiveTexture = textures.emissiveTexture;
  }


  /**
   * Gets the RGB color for this SceneMaterial.
   *
   * Each element of the color is in range ````[0..1]````.
   */
  get color(): Vec3 {
    return this._color;
  }

  /**
   * Sets the RGB color for this SceneMaterial.
   *
   * - Fires an {@link SceneEvents.onSceneMaterialColorChanged | SceneEvents.onSceneMaterialColorChanged} event on the Scene.
   * - Each element of the color is in range ````[0..1]````.
   */
  set color(value: Vec3) {
    if (this.destroyed) {
      this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneMaterial.color] Cannot set color on destroyed SceneMaterial ${this.id}`
      });
      return;
    }
    if (!value || value.length !== 3) {
      this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[SceneMaterial.color] Invalid color for SceneMaterial ${this.id}`
      });
      return;
    }
    let color = this._color;
    if (value) {
      color[0] = value[0];
      color[1] = value[1];
      color[2] = value[2];
    } else {
      color[0] = 1;
      color[1] = 1;
      color[2] = 1;
    }
    this.model.scene.events.onSceneMaterialColorChanged.dispatch(this.model.scene, this);
  }


  /**
   * Gets the opacity factor for this SceneMaterial.
   *
   * This is a factor in range ````[0..1]````.
   */
  get opacity(): number {
    return this._opacity;
  }

  /**
   * Sets the opacity factor for this SceneMaterial.
   *
   * - This is a factor in range ````[0..1]````.
   * - Fires an {@link SceneEvents.onSceneMaterialOpacityChanged | SceneEvents.onSceneMaterialOpacityChanged} event on the Scene.
   */
  set opacity(opacity: number) {
    if (this.destroyed) {
      this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneMaterial.opacity] Cannot set opacity on destroyed SceneMaterial ${this.id}`
      });
      return;
    }
    opacity = (opacity !== undefined && opacity !== null) ? opacity : 1.0;
    if (this._opacity === opacity) {
      return;
    }
    this._opacity = opacity;
    this.model.scene.events.onSceneMaterialOpacityChanged.dispatch(this.model.scene, this);
  }

  /**
   * Gets this SceneMaterial as SceneMaterialParams.
   */
  toParams(): SDKResult<SceneMaterialParams> {
    if (this.destroyed) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneMaterial.toParams] Cannot get params of destroyed SceneMaterial ${this.id}`
      });
    }
    const materialParams = <SceneMaterialParams>{
      id: this.id,
      color: Array.from(this._color),
      opacity: this._opacity
    };
    return {
      ok: true,
      value: materialParams
    };
  }

  /**
   * Destroys this SceneMaterial.
   */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.model._destroyMaterial(this);
    this.destroyed = true;
  }
}
