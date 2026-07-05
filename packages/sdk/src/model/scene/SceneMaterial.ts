import type {SceneTexture} from "./SceneTexture";
import type {SceneMaterialParams} from "./SceneMaterialParams";
import type {SceneModel} from "./SceneModel";
import {createVec3Float32, type Vec3} from "../../base/math/vector";
import {clamp01} from "../../base/math";
import {SDKErrorType, type SDKResult} from "../../base/core";
import {
  type LineStyle,
  type NormalisedLinePattern,
  emptyLinePattern,
  normaliseLinePattern,
} from "./linePattern";
import {
  type HatchStyle,
  type HatchParams,
  type NormalisedHatchPattern,
  emptyHatchPattern,
  normaliseHatchPattern,
} from "./hatchPattern";


/**
 * A set of {@link SceneTexture | Textures} in a {@link SceneModel | SceneModel}.
 *
 * * Stored in {@link SceneModel.materials | SceneModel.materials}
 * * Created with {@link SceneModel.createMaterial | SceneModel.createMaterial}
 * * Referenced by {@link SceneMaterial.material | SceneMaterial.material}
 *
 * See {@link scene | @xeokit/sdk/model/scene}   for usage.
 */
export class SceneMaterial {

  /**
   * The {@link model!scene.SceneModel | SceneModel} that owns this SceneMaterial.
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

  private _color: Vec3;

  /** @internal Emissive color factor (RGB, [0..1]). */
  private _emissiveColor: Vec3;

  private _opacity: number;

  private _roughness: number;

  private _metallic: number;

  /**
   * Alpha-handling mode encoded as a small integer:
   * `0 = OPAQUE`, `1 = MASK`, `2 = BLEND`. Matches the glTF 2.0
   * `alphaMode` semantics. The shader reads this to decide whether to
   * `discard` low-alpha fragments (`MASK`) or pass alpha through to the
   * blender (`BLEND`).
   */
  private _alphaMode: number;

  /**
   * Cut-off threshold for `MASK` mode. Fragments with
   * `albedoAlpha < alphaCutoff` are discarded.
   */
  private _alphaCutoff: number;

  /**
   * World-space repeat distance for the renderer's triplanar
   * texture-sampling fallback (engages when a mesh that carries
   * this material has no UV coordinates). Stored in scene units
   * per texture repeat. Materials whose meshes all carry UVs
   * ignore this value.
   */
  private _triplanarScale: number;

  /**
   * Per-material pixel line thickness for the renderer's thick
   * line draw technique. `0` means "use the View's
   * `linesMaterial.lineWidth` fallback"; any positive value
   * overrides that fallback per-material.
   */
  private _lineWidth: number;

  /**
   * Per-material dash / gap pattern, in line-width units. `len`
   * is `0` for the default "inherit the View-level pattern"
   * sentinel; any positive `len` overrides per-material. See
   * {@link linePattern}.
   */
  private _linePattern: NormalisedLinePattern;

  /**
   * Original user-facing value of {@link linePattern}, kept so
   * the getter can return what the caller passed in (`"dashed"`
   * vs. an equivalent `[3, 2]`) rather than the normalised
   * internal form.
   */
  private _linePatternUserValue: LineStyle | number[];

  /**
   * Per-material screen-space hatch pattern for triangle-surface
   * meshes. `count` is `0` for the default "solid (no hatch)"
   * sentinel; any positive `count` paints one to four line
   * families over the surface. See {@link hatchPattern}.
   */
  private _hatchPattern: NormalisedHatchPattern;

  /**
   * Original user-facing value of {@link hatchPattern}, kept so
   * the getter can return what the caller passed in (preset
   * name or {@link HatchParams}) rather than the normalised
   * internal form.
   */
  private _hatchPatternUserValue: HatchStyle | HatchParams;

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
    // Triplanar scale: clamp to a strictly positive minimum so the
    // shader's `worldPos / triplanarScale` can never blow up. The
    // upper bound is left open — values much larger than the scene
    // produce a single (mostly invisible) atlas tile across the
    // model, which is the user's intent if they ask for it.
    {
      const t = materialParams.triplanarScale;
      this._triplanarScale = (t !== undefined && t !== null && t > 1e-4) ? t : 1.0;
    }
    // Per-material line thickness. `0` flags "use the View's
    // global fallback" and is the default — clamp negative input
    // to that sentinel so a stray negative value can't reach the
    // shader as a perpendicular-direction sign-flip.
    {
      const w = materialParams.lineWidth;
      this._lineWidth = (w !== undefined && w !== null && w > 0) ? w : 0;
    }
    // Per-material dash / gap pattern. Default is "solid"
    // (= `len === 0`), which downstream consumers interpret as
    // "inherit the View-level pattern".
    this._linePattern = emptyLinePattern();
    this._linePatternUserValue = "solid";
    if (materialParams.linePattern !== undefined && materialParams.linePattern !== null) {
      this._linePatternUserValue = materialParams.linePattern;
      normaliseLinePattern(materialParams.linePattern, this._linePattern);
    }
    // Per-material screen-space hatch. Default is "solid"
    // (= `count === 0`), no overlay.
    this._hatchPattern = emptyHatchPattern();
    this._hatchPatternUserValue = "solid";
    if (materialParams.hatchPattern !== undefined && materialParams.hatchPattern !== null) {
      this._hatchPatternUserValue = materialParams.hatchPattern;
      normaliseHatchPattern(materialParams.hatchPattern, this._hatchPattern);
    }
    this.colorTexture = textures.colorTexture;
    this.metallicRoughnessTexture = textures.metallicRoughnessTexture;
    this.normalsTexture = textures.normalsTexture;
    this.occlusionTexture = textures.occlusionTexture;
    this.emissiveTexture = textures.emissiveTexture;
    // Auto-default the emissive factor to white when a material has an
    // emissive texture but no explicit factor — so it glows without the
    // caller restating `[1,1,1]`. No texture → `[0,0,0]` (no emission).
    this._emissiveColor = createVec3Float32(
      materialParams.emissiveColor || (textures.emissiveTexture ? [1, 1, 1] : [0, 0, 0])
    );
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
   * Gets the emissive color factor for this SceneMaterial, as *RGB* in
   * `[0..1]`. Multiplied against {@link SceneMaterial.emissiveTexture}.
   */
  get emissiveColor(): Vec3 {
    return this._emissiveColor;
  }

  /**
   * Sets the emissive color factor for this SceneMaterial.
   *
   * - Multiplied against {@link SceneMaterial.emissiveTexture}.
   * - Fires an {@link SceneEvents.onSceneMaterialEmissiveColorChanged | SceneEvents.onSceneMaterialEmissiveColorChanged} event on the Scene.
   * - Each element of the color is in range ````[0..1]````.
   */
  set emissiveColor(value: Vec3) {
    if (this.destroyed) {
      this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneMaterial.emissiveColor] Cannot set emissiveColor on destroyed SceneMaterial ${this.id}`
      });
      return;
    }
    if (!value || value.length !== 3) {
      this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[SceneMaterial.emissiveColor] Invalid emissiveColor for SceneMaterial ${this.id}`
      });
      return;
    }
    const emissiveColor = this._emissiveColor;
    emissiveColor[0] = value[0];
    emissiveColor[1] = value[1];
    emissiveColor[2] = value[2];
    this.model.scene.events.onSceneMaterialEmissiveColorChanged.dispatch(this.model.scene, this);
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
   * World-space repeat distance for triplanar texture sampling, in
   * scene units per texture repeat. Consulted by a renderer when
   * a mesh carrying this material has no UV coordinates and the
   * material binds a texture; ignored otherwise.
   */
  get triplanarScale(): number {
    return this._triplanarScale;
  }

  /**
   * Per-material pixel line thickness, in screen pixels. `0`
   * means "fall back to the View's `linesMaterial.lineWidth`";
   * any positive value overrides that fallback for meshes using
   * this material. Only line-primitive meshes consume it.
   */
  get lineWidth(): number {
    return this._lineWidth;
  }

  /**
   * Per-material dash / gap pattern. Returns the originally-set
   * preset name or `number[]` value the caller passed in — not
   * the normalised internal form. Default is `"solid"`
   * (= inherit the View-level pattern).
   */
  get linePattern(): LineStyle | number[] {
    return this._linePatternUserValue;
  }

  /** @internal — read by downstream consumers. */
  get _linePatternEntries(): Float32Array<any> {
    return this._linePattern.entries;
  }

  /** @internal — read by downstream consumers. */
  get _linePatternLen(): number {
    return this._linePattern.len;
  }

  /** @internal — read by downstream consumers. */
  get _linePatternPeriod(): number {
    return this._linePattern.period;
  }

  /**
   * Updates the per-material dash / gap pattern. Accepts the
   * same value shapes as the constructor's `linePattern` param
   * — a {@link LineStyle} preset name or a custom `number[]`.
   * The change fires
   * {@link SceneEvents.onSceneMaterialPatternChanged}, which
   * the renderer picks up to re-encode the material's slot in
   * its per-batch pattern table without re-uploading per-mesh
   * data.
   */
  set linePattern(value: LineStyle | number[]) {
    if (this.destroyed) {
      this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneMaterial.linePattern] Cannot set linePattern on destroyed SceneMaterial ${this.id}`
      });
      return;
    }
    this._linePatternUserValue = value;
    normaliseLinePattern(value, this._linePattern);
    this.model.scene.events.onSceneMaterialPatternChanged.dispatch(this.model.scene, this);
  }

  /**
   * Per-material hatch pattern. Returns the originally-set
   * preset name or {@link HatchParams} value the caller passed
   * in — not the normalised internal form. Default is
   * `"solid"` (no hatch).
   */
  get hatchPattern(): HatchStyle | HatchParams {
    return this._hatchPatternUserValue;
  }

  /** @internal — read by downstream consumers. */
  get _hatchPatternFamilies(): Float32Array<any> {
    return this._hatchPattern.families;
  }

  /** @internal — read by downstream consumers. */
  get _hatchPatternCount(): number {
    return this._hatchPattern.count;
  }

  /** @internal — read by downstream consumers. */
  get _hatchPatternColor(): Float32Array<any> {
    return this._hatchPattern.color;
  }

  /** @internal — read by downstream consumers. `0` for screen-space, `1` for world-space. */
  get _hatchPatternSpace(): number {
    return this._hatchPattern.space;
  }

  /**
   * Updates the per-material hatch pattern. Accepts the same
   * value shapes as the constructor's `hatchPattern` param —
   * a {@link HatchStyle} preset name or a {@link HatchParams}
   * object. Fires
   * {@link SceneEvents.onSceneMaterialPatternChanged}.
   */
  set hatchPattern(value: HatchStyle | HatchParams) {
    if (this.destroyed) {
      this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneMaterial.hatchPattern] Cannot set hatchPattern on destroyed SceneMaterial ${this.id}`
      });
      return;
    }
    this._hatchPatternUserValue = value;
    normaliseHatchPattern(value, this._hatchPattern);
    this.model.scene.events.onSceneMaterialPatternChanged.dispatch(this.model.scene, this);
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
      emissiveColor: Array.from(this._emissiveColor),
      opacity: this._opacity,
      roughness: this._roughness,
      metallic: this._metallic,
      alphaMode: this._alphaMode === 1 ? "MASK" : this._alphaMode === 2 ? "BLEND" : "OPAQUE",
      alphaCutoff: this._alphaCutoff,
      triplanarScale: this._triplanarScale,
      lineWidth: this._lineWidth,
      linePattern: cloneLinePattern(this._linePatternUserValue),
      hatchPattern: cloneHatchPattern(this._hatchPatternUserValue),
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
   * Refuses to destroy while at least one {@link model!scene.SceneMesh | SceneMesh} in the
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

function cloneLinePattern(value: LineStyle | number[]): LineStyle | number[] {
  return Array.isArray(value) ? Array.from(value) : value;
}

function cloneHatchPattern(value: HatchStyle | HatchParams): HatchStyle | HatchParams {
  if (typeof value === "string") {
    return value;
  }
  const cloned: HatchParams = {
    families: value.families.map(family => ({...family})),
  };
  if (value.color) {
    cloned.color = <Vec3>Array.from(value.color);
  }
  if (value.opacity !== undefined) {
    cloned.opacity = value.opacity;
  }
  if (value.space !== undefined) {
    cloned.space = value.space;
  }
  return cloned;
}
