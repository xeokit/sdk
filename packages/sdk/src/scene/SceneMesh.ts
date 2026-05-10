import {
  type Vec3,
  createVec3Float32,
} from "../math/vector";
import {
  createMat4Float64,
  type Mat4,
  identityMat4,
  inverseMat4,
  isIdentityMat4,
  mulMat4, composeMat4,
} from "../math/matrix";
import type {FloatArrayParam} from "../math";
import type {SceneGeometry} from "./SceneGeometry";
import type {SceneMeshParams} from "./SceneMeshParams";
import type {SceneObject} from "./SceneObject";
import type {SceneMaterial} from "./SceneMaterial";
import type {SceneModel} from "./SceneModel";
import type {SceneTexture} from "./SceneTexture";
import {SceneTransform} from "./SceneTransform";
import {SDKErrorType, type SDKResult, SDKTask} from "../core";

const DEFAULT_ROUGHNESS = 0.6;
const DEFAULT_METALLIC  = 0.0;

/**
 * A mesh in a {@link SceneModel | SceneModel}.
 *
 * * Stored in {@link SceneModel.meshes | SceneModel.meshes}
 * * Created with {@link SceneModel.createMesh | SceneModel.addMesh}
 * * Referenced by {@link SceneObject.meshes | SceneObject.meshes}
 *
 * See {@link scene | @xeokit/sdk/scene}   for usage.
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
   * The {@link SceneObject} that uses this SceneMesh.
   */
  object: SceneObject | null;

  /**
   * {@link SceneGeometry} used by this SceneMesh.
   */
  readonly geometry: SceneGeometry;

  /**
   * {@link SceneMaterial} used by this SceneMesh.
   *
   * The material is the canonical home for PBR parameters — roughness,
   * metallic, and the colour/normal/etc. textures all live there. A mesh
   * without a material falls back to renderer defaults (moderately rough
   * dielectric, no textures).
   */
  readonly material?: SceneMaterial;

  private _color: Vec3;
  private _opacity: number;
  private _localMatrix: Mat4;
  private _worldMatrix: Mat4;
  private _parentTransform: SceneTransform | null = null;
  private _worldMatrixDirty: boolean = true;

  destroyed: boolean = false;

  private _emitMatrixChangedEventTask: SDKTask;

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
  }) {
    this.id = meshParams.id;
    this.uniqueId = `${meshParams.model.id}__${meshParams.id}`;
    this.model = meshParams.model;
    this._localMatrix = meshParams.matrix ? createMat4Float64(meshParams.matrix) : identityMat4();
    this._worldMatrix = createMat4Float64();
    this._worldMatrixDirty = true;
    this.geometry = meshParams.geometry;
    this.material = meshParams.material;
    this._color = createVec3Float32(meshParams.color || [1, 1, 1]);
    this._opacity = (meshParams.opacity !== undefined && meshParams.opacity !== null) ? meshParams.opacity : 1.0;
    this.object = null;

    this._emitMatrixChangedEventTask = new SDKTask({
      name: "SceneMesh._emitMatrixChangedEventTask",
      task: () => {
        this.model.scene.events.onSceneMeshMatrixChanged.dispatch(this.model.scene, this);
      },
      stage: SDKTask.ComputeStage2 // Emit after transforms have been updated but before rendering
    });


  }

  /**
   * Gets the {@link SceneGeometry} used by this SceneMesh.
   */
  get geometryId(): string {
    return this.geometry.id;
  }


  /**
   * Gets the ID of the {@link SceneMaterial} used by this SceneMesh.
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
    if (matrix) {
      // @ts-ignore
      this._localMatrix.set(matrix);
    } else {
      identityMat4(this._localMatrix);
    }
    this.setWorldMatrixDirty();

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
    if (this._worldMatrixDirty) {
      if (this._parentTransform) {
        mulMat4( this._parentTransform.worldMatrix, this._localMatrix, this._worldMatrix);
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
    // if (this._worldMatrixDirty) {
    //   return;
    // }
    this._worldMatrixDirty = true;
    this._emitMatrixChangedEventTask.schedule();
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
      const currentWorld = createMat4Float64(this._worldMatrix);
      this._attachParentTransform(parentTransform);
      if (this._parentTransform) {
        const invParent = inverseMat4(this._parentTransform._worldMatrix, createMat4Float64());
        mulMat4(this._localMatrix, invParent, currentWorld);
      } else {
        // @ts-ignore
        this._localMatrix.set(currentWorld);
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
