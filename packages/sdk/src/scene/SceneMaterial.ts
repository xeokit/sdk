import type {SceneTexture} from "./SceneTexture";
import type {SceneMaterialParams} from "./SceneMaterialParams";
import type {SceneModel} from "./SceneModel";
import {createVec3Float32, type Vec3} from "../math/vector";
import {SDKErrorType, type SDKResult} from "../core";

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

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
  readonly model: SceneModel;

  /**
   * The ID of this SceneMaterial within the SceneModel.
   */
  readonly id: string;

  /**
   * The global ID of this SceneMaterial, unique among all SceneMaterials within the Scene,
   * which is the concatenation of the SceneModel's ID and this SceneMaterial's ID, separated by "__".
   */
  readonly uniqueId: string;

  _color: Vec3;

  _opacity: number;

  _roughness: number;

  _metallic: number;

  /**
   * Alpha-handling mode encoded as a small integer:
   * `0 = OPAQUE`, `1 = MASK`, `2 = BLEND`. Matches the glTF 2.0
   * `alphaMode` semantics. The shader reads this to decide whether to
   * `discard` low-alpha fragments (`MASK`) or pass alpha through to the
   * blender (`BLEND`).
   */
  _alphaMode: number;

  /**
   * Cut-off threshold for `MASK` mode. Fragments with
   * `albedoAlpha < alphaCutoff` are discarded.
   */
  _alphaCutoff: number;

  /**
   * The color {@link SceneTexture} in this set.
   */
  colorTexture?: SceneTexture;

  /**
   * The metallic-roughness {@link SceneTexture} in this set.
   */
  metallicRoughnessTexture?: SceneTexture;

  /**
   * The tangent-space normal map {@link SceneTexture} in this set.
   *
   * RGB encodes a tangent-space perturbation as `(x*0.5+0.5,
   * y*0.5+0.5, z*0.5+0.5)`. The renderer transforms it into view
   * space via a per-pixel TBN built from view-space derivatives.
   */
  normalsTexture?: SceneTexture;

  /**
   * The occlusion {@link SceneTexture} in this set.
   */
  occlusionTexture?: SceneTexture;

  /**
   * The emissive {@link SceneTexture} in this set.
   */
  emissiveTexture?: SceneTexture;

  /**
   * The count of {@link SceneMesh | SceneMeshes} that reference this
   * SceneMaterial. Maintained by `SceneModel.createMesh` /
   * `SceneModel._destroyMesh`. Used by {@link destroy} to refuse
   * destruction while at least one mesh still references the
   * material (the same guard {@link SceneGeometry.destroy} carries).
   */
  numMeshes: number;

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
                normalsTexture?: SceneTexture;
                colorTexture?: SceneTexture;
              }) {

    this.model = model;
    this.id = materialParams.id;
    this.uniqueId = `${model.id}__${this.id}`;
    this._color = createVec3Float32(materialParams.color || [1, 1, 1]);
    this._opacity = (materialParams.opacity !== undefined && materialParams.opacity !== null) ? materialParams.opacity : 1.0;
    // Cook-Torrance defaults: moderately rough dielectric. Clamped on
    // construction so out-of-range params logged as a constructor argument
    // can't break the shader (e.g. negative roughness producing NaN in
    // the GGX denominator).
    this._roughness = clamp01(
      (materialParams.roughness !== undefined && materialParams.roughness !== null) ? materialParams.roughness : 0.6
    );
    this._metallic = clamp01(
      (materialParams.metallic !== undefined && materialParams.metallic !== null) ? materialParams.metallic : 0.0
    );
    // Alpha mode: glTF default is OPAQUE. We accept the string form on
    // the way in (matches the glTF JSON) and store as a small integer
    // because that's what the per-mesh attribute texture packs to.
    const alphaMode = materialParams.alphaMode;
    this._alphaMode = alphaMode === "MASK" ? 1 : alphaMode === "BLEND" ? 2 : 0;
    this._alphaCutoff = clamp01(
      (materialParams.alphaCutoff !== undefined && materialParams.alphaCutoff !== null)
        ? materialParams.alphaCutoff
        : 0.5
    );
    this.colorTexture = textures.colorTexture;
    this.metallicRoughnessTexture = textures.metallicRoughnessTexture;
    this.normalsTexture = textures.normalsTexture;
    this.occlusionTexture = textures.occlusionTexture;
    this.emissiveTexture = textures.emissiveTexture;
    this.numMeshes = 0;
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
   * Microfacet roughness consumed by the Cook-Torrance BRDF.
   *
   * `0` is mirror-smooth, `1` is fully diffuse. Only consulted on the
   * smooth-shaded (per-vertex normals) render path.
   */
  get roughness(): number {
    return this._roughness;
  }

  /**
   * Metallic factor consumed by the Cook-Torrance BRDF.
   *
   * `0` is a pure dielectric (Fresnel `F0` is 0.04 grey); `1` is a pure
   * metal (Fresnel `F0` is the surface colour or sampled colour-texture
   * value, diffuse term suppressed). Only consulted on the smooth-shaded
   * render path.
   */
  get metallic(): number {
    return this._metallic;
  }

  /**
   * Alpha-handling mode: `0 = OPAQUE`, `1 = MASK`, `2 = BLEND`.
   * Matches the glTF 2.0 `alphaMode` semantics.
   */
  get alphaMode(): number {
    return this._alphaMode;
  }

  /**
   * Cut-off threshold used when `alphaMode === MASK`. Fragments with
   * `albedoAlpha < alphaCutoff` are discarded by the renderer.
   */
  get alphaCutoff(): number {
    return this._alphaCutoff;
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
      opacity: this._opacity,
      roughness: this._roughness,
      metallic: this._metallic
    };
    if (this.colorTexture) materialParams.colorTextureId = this.colorTexture.id;
    if (this.metallicRoughnessTexture) materialParams.metallicRoughnessTextureId = this.metallicRoughnessTexture.id;
    if (this.normalsTexture) materialParams.normalsTextureId = this.normalsTexture.id;
    if (this.occlusionTexture) materialParams.occlusionTextureId = this.occlusionTexture.id;
    if (this.emissiveTexture) materialParams.emissiveTextureId = this.emissiveTexture.id;
    return {
      ok: true,
      value: materialParams
    };
  }

  /**
   * Destroys this SceneMaterial.
   *
   * Refuses to destroy while at least one {@link SceneMesh} in the
   * SceneModel still references this material — destroy or
   * reassign those meshes first. Mirrors {@link SceneGeometry.destroy}.
   */
  destroy(): SDKResult<void> {
    if (this.destroyed) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneMaterial.destroy] SceneMaterial '${this.id}' already destroyed`
      });
    }
    if (this.numMeshes > 0) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneMaterial.destroy] Cannot destroy SceneMaterial '${this.id}' - ` +
               `still referenced by ${this.numMeshes} SceneMesh(es), which you need to destroy first`
      });
    }
    this.model._destroyMaterial(this);
    this.destroyed = true;
    return {ok: true, value: undefined};
  }
}
