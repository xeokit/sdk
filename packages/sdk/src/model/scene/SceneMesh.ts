import {
  type Vec3,
  createVec3Float32,
} from "../../base/math/vector";
import {
  createMat4Float64,
  type Mat4,
  identityMat4,
  inverseMat4,
  isIdentityMat4,
  mulMat4, composeMat4,
} from "../../base/math/matrix";
import type {FloatArrayParam} from "../../base/math";
import type {SceneGeometry} from "./SceneGeometry";
import type {SceneMeshParams} from "./SceneMeshParams";
import type {SceneObject} from "./SceneObject";
import type {SceneMaterial} from "./SceneMaterial";
import type {SceneModel} from "./SceneModel";
import type {SceneTexture} from "./SceneTexture";
import {SceneTransform} from "./SceneTransform";
import {SDKErrorType, type SDKResult} from "../../base/core";

const DEFAULT_ROUGHNESS       = 0.6;
const DEFAULT_METALLIC        = 0.0;
const DEFAULT_TRIPLANAR_SCALE = 1.0;
const DEFAULT_LINE_WIDTH      = 0.0;  // 0 = fall back to View linesMaterial.lineWidth

/**
 * Shared local matrix for untransformed meshes. A mesh created without a
 * `matrix` references this single instance instead of allocating its own
 * identity matrix; on the first matrix write it allocates a private one
 * (see {@link SceneMesh._ownLocalMatrix}). Never mutated in place.
 */
const SHARED_IDENTITY_MATRIX: Mat4 = identityMat4();

/**
 * A mesh in a {@link SceneModel | SceneModel}.
 *
 * * Stored in {@link SceneModel.meshes | SceneModel.meshes}
 * * Created with {@link SceneModel.createMesh | SceneModel.addMesh}
 * * Referenced by {@link SceneObject.meshes | SceneObject.meshes}
 *
 * See {@link scene | @xeokit/sdk/model/scene}   for usage.
 */
export class SceneMesh {

  /**
   * Unique ID of this SceneMesh.
   *
   * SceneMesh is stored by this ID in {@link SceneModel.meshes}.
   */
  readonly id: string;

  /**
   * The global ID of this SceneMesh, unique among all SceneMeshes within the Scene,
   * which is the concatenation of the SceneModel's ID and this SceneMesh's ID, separated by "__".
   */
  readonly uniqueId: string;

  /**
   * The SceneModel that contains this SceneMesh.
   */
  readonly model: SceneModel;

  /**
   * The {@link model!scene.SceneObject | SceneObject} that uses this SceneMesh.
   */
  object: SceneObject | null;

  /**
   * {@link model!scene.SceneGeometry | SceneGeometry} used by this SceneMesh.
   */
  readonly geometry: SceneGeometry;

  /**
   * {@link model!scene.SceneMaterial | SceneMaterial} used by this SceneMesh.
   *
   * The material is the canonical home for PBR parameters — roughness,
   * metallic, and the colour/normal/etc. textures all live there. A mesh
   * without a material falls back to renderer defaults (moderately rough
   * dielectric, no textures).
   */
  readonly material?: SceneMaterial;

  /**
   * Free-form bin identifier this SceneMesh belongs to. Frozen at
   * construction; the scene assigns no semantics to the value on its own.
   *
   * The bin is a tag the caller stamps on the SceneMesh for downstream
   * consumers to group by. A **renderer** — were it rendering this scene
   * — is expected to honour the tag as follows:
   *
   * - Partition the visible SceneMeshes by `bin` value (a missing or
   *   empty `bin` is treated as the implicit "default" group).
   * - Process the groups in an order the renderer documents (e.g.
   *   default first, then any meshes tagged `"overlay"` after, with the
   *   depth buffer cleared between groups so the overlay group reads as
   *   floating on top of the rest of the scene).
   * - Honour any per-bin policy the renderer documents (depth clearing,
   *   depth-test enabled / disabled, picking priority, …).
   *
   * Bin membership lives on SceneMesh rather than
   * {@link model!scene.SceneObject | SceneObject} because renderable
   * batching happens at mesh granularity — a SceneMesh can be processed
   * by a renderer without ever being assigned to a SceneObject, so this
   * is the layer at which bin membership is meaningful. Tools that
   * consume the scene but do not render it — model builders, exporters,
   * format converters, structural inspectors — may use `bin` as a
   * free-form classification, or ignore it. Loaders and exporters
   * round-trip the value verbatim.
   */
  readonly bin?: string;

  private _color: Vec3;
  private _opacity: number;
  private _localMatrix: Mat4;
  // Lazily allocated: only when world != local (a parent transform exists or
  // the model's coordinate system is non-identity). When world == local the
  // getter returns `_localMatrix` directly, so most meshes never allocate this.
  private _worldMatrix: Mat4 | null;
  private _parentTransform: SceneTransform | null = null;
  private _worldMatrixDirty: boolean = true;

  destroyed: boolean = false;

  /**
   * @private
   */
  constructor(meshParams: {
    id: string;
    model: SceneModel;
    geometry: SceneGeometry;
    material?: SceneMaterial;
    matrix?: Mat4;
    color?: Vec3;
    opacity?: number;
    bin?: string;
  }) {
    this.id = meshParams.id;
    this.uniqueId = `${meshParams.model.id}__${meshParams.id}`;
    this.model = meshParams.model;
    // Take ownership of the supplied matrix — SceneModel.createMesh (the only
    // caller) already hands over a freshly-built/cloned matrix, so cloning again
    // here would double the per-mesh allocation on large models. An untransformed
    // mesh shares the identity sentinel rather than allocating its own.
    this._localMatrix = meshParams.matrix ?? SHARED_IDENTITY_MATRIX;
    this._worldMatrix = null;
    this._worldMatrixDirty = true;
    this.geometry = meshParams.geometry;
    this.material = meshParams.material;
    this.bin = meshParams.bin;
    this._color = createVec3Float32(meshParams.color || [1, 1, 1]);
    this._opacity = (meshParams.opacity !== undefined && meshParams.opacity !== null) ? meshParams.opacity : 1.0;
    this.object = null;

  }

  /**
   * Gets the {@link model!scene.SceneGeometry | SceneGeometry} used by this SceneMesh.
   */
  get geometryId(): string {
    return this.geometry.id;
  }


  /**
   * Gets the ID of the {@link model!scene.SceneMaterial | SceneMaterial} used by this SceneMesh.
   */
  get materialId(): string {
    return this.material?.id;
  }


  /**
   * Gets the RGB color for this SceneMesh.
   *
   * Each element of the color is in range ````[0..1]````.
   */
  get color(): Vec3 {
    return this._color;
  }

  /**
   * Sets the RGB color for this SceneMesh.
   *
   * - Fires an {@link SceneEvents.onSceneMeshColorChanged | SceneEvents.onSceneMeshColorChanged} event on the Scene.
   * - Each element of the color is in range ````[0..1]````.
   * -- Overriden by the color of the material if this SceneMesh has a material.
   */
  set color(value: Vec3) {
    if (this.destroyed) {
      this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneMesh.color] Cannot set color on destroyed SceneMesh ${this.id}`
      });
      return;
    }
    if (!value || value.length !== 3) {
      this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[SceneMesh.color] Invalid color for SceneMesh ${this.id}`
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
    this.model.scene.events.onSceneMeshColorChanged.dispatch(this.model.scene, this);
  }

  /**
   * Gets the effective RGB color for this SceneMesh, which is the color of the SceneMaterial if it has one,
   * or the SceneMesh's own color otherwise.
   */
  get effectiveColor(): Vec3 {
    if (this.material) {
      return this.material.color;
    }
    return this._color;
  }

  /**
   * Updates this SceneMesh's local modeling transform matrix.
   *
   * - Fires an {@link SceneEvents.onSceneMeshMatrixChanged | SceneEvents.onSceneMeshMatrixChanged} event on the Scene.
   * - Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
   *
   * @type {FloatArrayParam}
   */
  set matrix(matrix: Mat4) {
    if (this.destroyed) {
      this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneMesh.matrix] Cannot set matrix on destroyed SceneMesh ${this.id}`
      });
      return;
    }
    if (!matrix || matrix.length !== 16) {
      this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[SceneMesh.matrix] Invalid matrix for SceneMesh ${this.id}`
      });
      return;
    }
    // @ts-ignore
    this._ownLocalMatrix().set(matrix);
    this.setWorldMatrixDirty();

  }

  /**
   * Returns a private, writable `_localMatrix`, replacing the shared identity
   * sentinel with a fresh copy on first write so in-place mutation never
   * corrupts the matrix shared by every untransformed mesh.
   */
  private _ownLocalMatrix(): Mat4 {
    if (this._localMatrix === SHARED_IDENTITY_MATRIX) {
      this._localMatrix = createMat4Float64(SHARED_IDENTITY_MATRIX);
    }
    return this._localMatrix;
  }

  /**
   * Gets this SceneMesh's local modeling transform matrix.
   *
   * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
   */
  get matrix(): Mat4 {
    return this._localMatrix;
  }

  /**
   * Gets the global transform matrix for this SceneMesh.
   */
  get worldMatrix(): Mat4 {
    // Common case: no parent transform and an identity model coordinate system,
    // so the world matrix equals the local matrix. Return it directly rather
    // than maintaining a redundant per-mesh copy — this avoids allocating
    // `_worldMatrix` for the great majority of meshes.
    if (!this._parentTransform && isIdentityMat4(this.model.coordinateSystemMatrix)) {
      return this._localMatrix;
    }
    if (this._worldMatrixDirty || !this._worldMatrix) {
      if (!this._worldMatrix) {
        this._worldMatrix = createMat4Float64();
      }
      if (this._parentTransform) {
        mulMat4(this._parentTransform.worldMatrix, this._localMatrix, this._worldMatrix);
      } else {
        mulMat4(this.model.coordinateSystemMatrix, this._localMatrix, this._worldMatrix);
      }
      this._worldMatrixDirty = false;
    }
    return this._worldMatrix;
  }

  /**
   * Gets the opacity factor for this SceneMesh.
   *
   * This is a factor in range ````[0..1]````.
   */
  get opacity(): number {
    return this._opacity;
  }

  /**
   * Sets the opacity factor for this SceneMesh.
   *
   * - This is a factor in range ````[0..1]````.
   * - Fires an {@link SceneEvents.onSceneMeshOpacityChanged | SceneEvents.onSceneMeshOpacityChanged} event on the Scene.
   */
  set opacity(opacity: number) {
    if (this.destroyed) {
      this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneMesh.opacity] Cannot set opacity on destroyed SceneMesh ${this.id}`
      });
      return;
    }
    opacity = (opacity !== undefined && opacity !== null) ? opacity : 1.0;
    if (this._opacity === opacity) {
      return;
    }
    this._opacity = opacity;
    this.model.scene.events.onSceneMeshOpacityChanged.dispatch(this.model.scene, this);
  }

  /**
   * Gets the effective opacity factor for this SceneMesh, which is the opacity of the material if it has one,
   * or the local opacity otherwise. This is a factor in range ````[0..1]````.
   */
  get effectiveOpacity(): number {
    return this.material ? this.material.opacity : this._opacity;
  }

  /**
   * Effective microfacet roughness — the material's roughness if a
   * material is attached, otherwise the renderer default (0.6).
   *
   * The renderer's Cook-Torrance BRDF reads this; meshes without a
   * material render as a moderately-rough dielectric.
   */
  get effectiveRoughness(): number {
    return this.material ? this.material.roughness : DEFAULT_ROUGHNESS;
  }

  /**
   * Effective metallic factor — the material's metallic value if a
   * material is attached, otherwise the renderer default (0.0).
   */
  get effectiveMetallic(): number {
    return this.material ? this.material.metallic : DEFAULT_METALLIC;
  }

  /**
   * Effective albedo (colour) texture — the material's `colorTexture`
   * if a material is attached, otherwise `undefined`. Untextured meshes
   * sample the per-batch atlas's white sentinel.
   */
  get effectiveColorTexture(): SceneTexture | undefined {
    return this.material ? this.material.colorTexture : undefined;
  }

  /**
   * Effective metallic-roughness texture — the material's
   * `metallicRoughnessTexture` if a material is attached, otherwise
   * `undefined`. Channel layout follows glTF 2.0: `G` = roughness,
   * `B` = metallic. Untextured meshes sample the per-batch MR atlas's
   * white sentinel — a multiplicative passthrough.
   */
  get effectiveMetallicRoughnessTexture(): SceneTexture | undefined {
    return this.material ? this.material.metallicRoughnessTexture : undefined;
  }

  /**
   * Effective tangent-space normal map — the material's `normalsTexture`
   * if a material is attached, otherwise `undefined`. Encoded RGB with
   * `(x, y, z) = sample.rgb * 2 - 1`. Untextured meshes sample the
   * per-batch normal-map atlas's neutral sentinel `(128, 128, 255, 255)`,
   * which decodes to `(0, 0, 1)` — no perturbation.
   */
  get effectiveNormalsTexture(): SceneTexture | undefined {
    return this.material ? this.material.normalsTexture : undefined;
  }

  /**
   * Effective emissive texture — the material's `emissiveTexture` if a
   * material is attached, otherwise `undefined`. sRGB; the shader multiplies
   * it by {@link SceneMesh.effectiveEmissiveColor} and adds the result to the
   * lit colour. Untextured meshes sample the emissive atlas's white sentinel,
   * which the `[0,0,0]` factor suppresses.
   */
  get effectiveEmissiveTexture(): SceneTexture | undefined {
    return this.material ? this.material.emissiveTexture : undefined;
  }

  /**
   * Effective ambient-occlusion texture — the material's `occlusionTexture`
   * if a material is attached, otherwise `undefined`. AO in the `R` channel,
   * multiplied into the indirect lighting term. Untextured meshes sample the
   * occlusion atlas's white sentinel (`R = 1` → no occlusion).
   */
  get effectiveOcclusionTexture(): SceneTexture | undefined {
    return this.material ? this.material.occlusionTexture : undefined;
  }

  /**
   * Effective emissive colour factor — the material's `emissiveColor` if a
   * material is attached, otherwise `[0,0,0]` (no emission).
   */
  get effectiveEmissiveColor(): [number, number, number] {
    return this.material
      ? (Array.from(this.material.emissiveColor) as [number, number, number])
      : [0, 0, 0];
  }

  /**
   * Effective alpha-handling mode: `0 = OPAQUE`, `1 = MASK`, `2 = BLEND`.
   * Defaults to `OPAQUE` when no material is attached.
   */
  get effectiveAlphaMode(): number {
    return this.material ? this.material.alphaMode : 0;
  }

  /**
   * Effective `alphaCutoff` threshold for `MASK` mode. Defaults to `0.5`
   * when no material is attached (matches glTF default).
   */
  get effectiveAlphaCutoff(): number {
    return this.material ? this.material.alphaCutoff : 0.5;
  }

  /**
   * Effective triplanar repeat distance — the material's
   * `triplanarScale` if a material is attached, otherwise the
   * renderer default (1.0). Read by the triplanar shader variant
   * to convert world-space position into texture-sample
   * coordinates; ignored on UV-bearing batches.
   */
  get effectiveTriplanarScale(): number {
    return this.material ? this.material.triplanarScale : DEFAULT_TRIPLANAR_SCALE;
  }

  /**
   * Effective per-mesh line thickness in pixels for the
   * thick-line draw technique. Returns the attached material's
   * `lineWidth` when one is bound; otherwise `0` to signal
   * "fall back to the View's `linesMaterial.lineWidth`". The
   * thick-line vertex shader implements that fallback.
   */
  get effectiveLineWidth(): number {
    return this.material ? this.material.lineWidth : DEFAULT_LINE_WIDTH;
  }

  /**
   * Effective dash / gap pattern entries (line-width units) for
   * this mesh. Returns the attached material's pattern array
   * when bound; otherwise `null` to signal "no per-mesh
   * pattern — inherit the View-level fallback".
   *
   * Eight entries wide, zero-padded after the pattern length.
   * Callers should consult {@link effectiveLinePatternLen} to
   * find the in-use count.
   */
  get effectiveLinePatternEntries(): Float32Array<any> | null {
    return this.material ? this.material._linePatternEntries : null;
  }

  /**
   * Effective dash / gap pattern length for this mesh. `0`
   * means "no per-mesh pattern — inherit the View-level
   * fallback"; any positive value overrides it.
   */
  get effectiveLinePatternLen(): number {
    return this.material ? this.material._linePatternLen : 0;
  }

  /**
   * Effective dash / gap pattern period (sum of in-use entries,
   * in line-width units) — the natural modulus base when walking
   * the pattern along a segment. `0` when no per-mesh pattern is
   * set.
   */
  get effectiveLinePatternPeriod(): number {
    return this.material ? this.material._linePatternPeriod : 0;
  }

  /**
   * Effective hatch line families for this mesh. Returns the
   * attached material's pattern array when bound; otherwise
   * `null` to signal "no per-mesh hatch — render the surface
   * normally".
   *
   * Four families × four floats wide, zero-padded after the
   * family count. Each family occupies four consecutive slots:
   * `[cos(angle), sin(angle), spacing, lineWidth]`. Callers
   * should consult {@link effectiveHatchPatternCount} for the
   * in-use family count.
   */
  get effectiveHatchPatternFamilies(): Float32Array<any> | null {
    return this.material ? this.material._hatchPatternFamilies : null;
  }

  /**
   * Effective number of hatch line families for this mesh
   * (`0..4`). `0` means "no hatch — surface renders without
   * overlay".
   */
  get effectiveHatchPatternCount(): number {
    return this.material ? this.material._hatchPatternCount : 0;
  }

  /**
   * Effective hatch ink colour for this mesh as a four-float
   * `(r, g, b, opacity)` array. All channels are in `[0, 1]`.
   * Returns `null` when the mesh has no material attached.
   */
  get effectiveHatchPatternColor(): Float32Array<any> | null {
    return this.material ? this.material._hatchPatternColor : null;
  }

  /**
   * Effective hatch coordinate-space flag — `0` for screen
   * space, `1` for world space. Returns `0` when the mesh has
   * no material attached.
   */
  get effectiveHatchPatternSpace(): number {
    return this.material ? this.material._hatchPatternSpace : 0;
  }

  /**
   * Gets the parent {@link SceneTransform} of this SceneMesh, or ````null```` if this SceneMesh is not parented.
   */
  get parentTransform(): SceneTransform | null {
    return this._parentTransform;
  }

  /**
   * Updates the global transform matrix.
   * @internal
   */
  setWorldMatrixDirty(): void {
    this._worldMatrixDirty = true;
    // Dispatched synchronously so spatial structures (collision index, culler)
    // are fresh for a fit/pick issued right after a transform. worldMatrix is
    // computed lazily on read, so subscribers always observe the current value
    // regardless of dispatch timing; the UI panels self-debounce to one paint
    // per frame, and the renderer's per-mesh GPU update is idempotent.
    this.model.scene.events.onSceneMeshMatrixChanged.dispatch(this.model.scene, this);
  }

  /**
   * Attaches a parent transform to this transform.
   * @param parent - The new parent transform or null to detach.
   */
  private _attachParentTransform(parent: SceneTransform | null): void {
    if (this._parentTransform === parent) {
      return;
    }
    if (this._parentTransform) {
      const idx = this._parentTransform._childMeshes.indexOf(this);
      if (idx !== -1) {
        this._parentTransform._childMeshes.splice(idx, 1);
      }
    }
    this._parentTransform = parent;
    if (parent) {
      parent._childMeshes.push(this);
    }
    this.setWorldMatrixDirty();
  }

  /**
   * Sets the parent transform for this mesh.
   * @param parentTransformId - The ID of the new parent transform, or null to detach.
   * @param opts - Options to preserve world transformation.
   */
  public setParentTransformId(parentTransformId: string, opts?: { preserveWorld?: boolean }): SDKResult<any> {
    if (this.destroyed) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneMesh.setParentTransformId] Cannot set parent transform on destroyed SceneMesh ${this.id}`
      });
    }
    let parentTransform: SceneTransform | null = null;
    if (parentTransformId) {
      parentTransform = this.model.transforms[parentTransformId];
      if (!parentTransform) {
        return this.model.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidOperation,
          error: `[SceneMesh.setParentTransformId] SceneTransform "${parentTransformId}" not found in SceneModel`
        });
      }
      if (parentTransform.model.id !== this.model.id) {
        return this.model.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidOperation,
          error: `[SceneMesh.setParentTransformId] Cannot set parent transform to a SceneMesh in a different SceneModel: ${this.id}`
        });
      }
    }
    const preserve = !!opts?.preserveWorld;
    if (preserve) {
      this.setWorldMatrixDirty();
      const currentWorld = createMat4Float64(this.worldMatrix as Mat4);
      this._attachParentTransform(parentTransform);
      if (this._parentTransform) {
        const invParent = inverseMat4(this._parentTransform._worldMatrix, createMat4Float64());
        mulMat4(this._localMatrix, invParent, currentWorld);
      } else {
        // @ts-ignore
        this._ownLocalMatrix().set(currentWorld);
      }
      this.setWorldMatrixDirty();
    } else {
      this._attachParentTransform(parentTransform);
    }
    return {ok: true, value: undefined};
  }

  /**
   * Gets this SceneMesh as SceneMeshParams.
   */
  toParams(): SDKResult<SceneMeshParams> {
    if (this.destroyed) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneMesh.toParams] Cannot get params of destroyed SceneMesh ${this.id}`
      });
    }
    const meshParams = <SceneMeshParams>{
      id: this.id,
      geometryId: this.geometry.id,
      color: Array.from(this._color),
      opacity: this._opacity
    };
    if (!isIdentityMat4(this._localMatrix)) {
      meshParams.matrix = <Mat4>Array.from(this._localMatrix);
    }
    if (this.material !== null && this.material !== undefined) {
      meshParams.materialId = this.material.id;
    }
    if (this._parentTransform !== null && this._parentTransform !== undefined) {
      meshParams.parentTransformId = this.parentTransform.id;
    }
    if (this.bin !== undefined) {
      meshParams.bin = this.bin;
    }
    return {
      ok: true,
      value: meshParams
    };
  }

  /**
   * Destroys this SceneMesh.
   *
   * - Fires an {@link SceneEvents.onSceneMeshDestroyed | SceneEvents.onSceneMeshDestroyed} event on the Scene.
   * - You cannot destroy a SceneMesh that is currently used by a SceneObject; you must destroy the SceneObject first.
   */
  destroy(): SDKResult<void> {
    if (this.destroyed) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[SceneMesh.destroy] SceneMesh already destroyed"
      });
    }
    if (this.object) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[SceneMesh.destroy] Cannot destroy SceneMesh ${this.id} - SceneMesh is currently used by SceneObject ${this.object.id}, which you need to destroy first`
      });
    }
    if (this._parentTransform) {
      this._parentTransform.removeChildMesh(this.id);
    }
    this._parentTransform = null;
    this.model._destroyMesh(this);
    this.destroyed = true;
    return {
      ok: true,
      value: undefined
    };
  }
}
