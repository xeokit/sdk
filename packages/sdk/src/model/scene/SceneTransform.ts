import {
  composeMat4,
  createMat4Float64,
  decomposeMat4,
  identityMat4,
  inverseMat4,
  mulMat4,
  type Mat4
} from "../../base/math/matrix";

import type {SceneModel} from "./SceneModel";
import type {SceneMesh} from "./SceneMesh";
import type {SceneTransformParams} from "./SceneTransformParams";

import {SDKErrorType, type SDKResult, SDKTask} from "../../base/core";

import {createVec3Float64, type Vec3} from "../../base/math/vector";
import {
  createQuatFloat64,
  eulerToQuat,
  identityQuat,
  quatToEuler,
  type Quat
} from "../../base/math/quat";
import {createCoordinateSystemTransform} from "./createCoordinateSystemTransform";

/**
 * Represents a spatial transform within a {@link model!scene.SceneModel | SceneModel}.
 *
 * A {@link SceneTransform} defines a local coordinate space using position, rotation, and scale,
 * and can be composed into a hierarchy of transforms. {@link model!scene.SceneMesh | SceneMesh} instances are typically
 * attached to transforms, allowing geometry to inherit transforms from parent nodes.
 *
 * ### Key concepts
 *
 * - Transforms form a tree (scene graph) within a {@link model!scene.SceneModel | SceneModel}
 * - Each transform has an optional parent transform
 * - Child transforms and meshes inherit the parent’s transform
 * - Transforms can be authored using TRS (position / rotation / scale) or a matrix
 *
 * ### Typical usage
 *
 * Transforms are created via {@link SceneModel.createTransform} and referenced by ID.
 * Meshes are attached to transforms, and meshes can then be grouped into {@link model!scene.SceneObject | SceneObject}s
 * for selection, visibility, and interaction.
 *
 * @example
 * ```ts
 * // Create a root transform positioned in world space
 * sceneModel.createTransform({
 *   id: "rootTransform",
 *   position: [100000, 0, 0]
 * });
 *
 * // Create a child transform for a table leg
 * sceneModel.createTransform({
 *   id: "childTransform",
 *   parentTransformId: "rootTransform",
 *   position: [-4, -6, -4],
 *   scale: [1, 3, 1]
 * });
 *
 * // Create geometry
 * sceneModel.createGeometry({
 *  id: "demoGeometry",
 *  //...
 *  });
 *
 * // Attach a mesh to the transform
 * sceneModel.createMesh({
 *   id: "redLegMesh",
 *   geometryId: "demoGeometry",
 *   parentTransformId: "childTransform",
 *   color: [1, 0, 0]
 * });
 *
 * // Group the mesh into a scene object
 * sceneModel.createObject({
 *   id: "redLegObject",
 *   meshIds: ["redLegMesh"]
 * });
 *
 * // Update transforms dynamically (eg. animation)
 * const root = sceneModel.transforms["rootTransform"];
 * root.rotation = [0, performance.now() / 40, 0];
 * ```
 *
 * ### Notes
 *
 * - Setting {@link position}, {@link rotation}, {@link quaternion}, or {@link scale}
 *   updates the local transform.
 * - Setting {@link matrix} directly replaces the local transform and updates TRS values.
 * - Destroying a transform automatically detaches it from the hierarchy.
 *
 * See {@link model!scene | @xeokit/sdk/model/scene} for more complete examples.
 */
export class SceneTransform {

  /** Unique identifier for this transform within the {@link model!scene.SceneModel | SceneModel}. */
  readonly id: string;

  /** The global ID of this SceneTransform, unique among all SceneTransforms within the Scene, **/
  readonly uniqueId: string;

  /** The {@link model!scene.SceneModel | SceneModel} this transform belongs to. */
  readonly model: SceneModel;

  /** Local scale vector (XYZ). Defaults to `[1, 1, 1]`. */
  private _scale: Vec3 = createVec3Float64([1, 1, 1]);

  /** Local Euler rotation in degrees (XYZ order). Kept in sync with {@link _quaternion}. */
  private _rotation: Vec3 = createVec3Float64([0, 0, 0]);

  /** Local position (XYZ). Defaults to `[0, 0, 0]`. */
  private _position: Vec3 = createVec3Float64([0, 0, 0]);

  /** Local orientation quaternion. Kept in sync with {@link _rotation}. */
  private _quaternion: Quat = createQuatFloat64();

  /**
   * Local transformation matrix (TRS) relative to {@link parentTransform}.
   *
   * - If {@link _localMatrixDirty} is `true`, this matrix is rebuilt from TRS.
   * - You can also set this directly via {@link matrix}, which decomposes into TRS.
   */
  private _localMatrix: Mat4 = identityMat4();

  /**
   * Global transformation matrix in model/world space.
   *
   * Computed as:
   * - `parent.worldMatrix * localMatrix` when a parent exists
   * - `localMatrix` when no parent exists
   *
   * @private
   */
  private _worldMatrix: Mat4;

  /** True when {@link _localMatrix} needs rebuilding from TRS. */
  private _localMatrixDirty = false;

  /** True when {@link _worldMatrix} needs rebuilding. */
  private _worldMatrixDirty = true;

  /**
   * Child meshes directly parented to this transform.
   * @private
   */
  _childMeshes: SceneMesh[] = [];

  /** Child transforms directly parented to this transform. */
  private _childTransforms: SceneTransform[] = [];

  /** Parent transform, or `null` when this transform is a root. */
  private _parentTransform: SceneTransform | null = null;

  /**
   * True once {@link destroy} has been called.
   */
  public destroyed = false;

  /**
   * Batched task that propagates dirtiness through the transform tree after local changes.
   * Scheduled in {@link SDKTask.ComputeStage} so local updates happen before global updates.
   */
  private _markTreeDirtyTask: SDKTask;

  /**
   * Creates a new {@link SceneTransform}.
   *
   * If `transformParams.matrix` is provided, it is used as the local matrix and decomposed
   * into TRS (keeping Euler/quaternion consistent). Otherwise, TRS components are applied.
   * @private
   */
  constructor(model: SceneModel, transformParams: SceneTransformParams) {
    this.id = transformParams.id;
    this.uniqueId = `${model.id}__${this.id}`;
    this.model = model;

    this._localMatrix = transformParams.matrix
      ? createMat4Float64(transformParams.matrix)
      : identityMat4();

    this._worldMatrix = createMat4Float64();

    this._markTreeDirtyTask = new SDKTask({
      name: "SceneTransform._markTreeDirtyTask",
      stage: SDKTask.ComputeStage,
      task: () => this.setWorldMatrixDirty()
    });

    if (transformParams.matrix) {
      this.matrix = transformParams.matrix;
      return;
    }

    this.scale = transformParams.scale;
    this.position = transformParams.position;

    if (transformParams.quaternion) {
      this.quaternion = transformParams.quaternion as Quat;
    } else {
      this.rotation = transformParams.rotation;
    }
  }

  // ------------------------------------------------------------------------------------------------
  // Local TRS
  // ------------------------------------------------------------------------------------------------

  /** Sets the local scale (XYZ). */
  set scale(scale: Vec3) {
    if (this.destroyed) {
      this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneTransform.scale] Cannot set scale on destroyed SceneTransform ${this.id}`
      });
      return;
    }
    // @ts-ignore
    this._scale.set(scale ?? [1, 1, 1]);
    this._setLocalDirty();
  }

  /** Gets the local scale (XYZ). */
  get scale(): Vec3 {
    return this._scale;
  }

  /** Sets the local rotation as Euler angles in degrees (XYZ order). */
  set rotation(rotation: Vec3) {
    if (this.destroyed) {
      this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneTransform.rotation] Cannot set rotation on destroyed SceneTransform ${this.id}`
      });
      return;
    }
    // @ts-ignore
    this._rotation.set(rotation ?? [0, 0, 0]);
    eulerToQuat(this._rotation, "XYZ", this._quaternion);
    this._setLocalDirty();
  }

  /** Gets the local rotation as Euler angles in degrees (XYZ order). */
  get rotation(): Vec3 {
    return this._rotation;
  }

  /** Sets the local rotation as a quaternion. */
  set quaternion(quaternion: Quat) {
    if (this.destroyed) {
      this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneTransform.quaternion] Cannot set quaternion on destroyed SceneTransform ${this.id}`
      });
      return;
    }
    // @ts-ignore
    this._quaternion.set(quaternion);
    quatToEuler(this._quaternion, "XYZ", this._rotation);
    this._setLocalDirty();
  }

  /** Gets the local rotation quaternion. */
  get quaternion(): Quat {
    return this._quaternion;
  }

  /** Sets the local position (XYZ). */
  set position(position: Vec3) {
    if (this.destroyed) {
      this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneTransform.position] Cannot set position on destroyed SceneTransform ${this.id}`
      });
      return;
    }
    // @ts-ignore
    this._position.set(position ?? [0, 0, 0]);
    this._setLocalDirty();
  }

  /** Gets the local position (XYZ). */
  get position(): Vec3 {
    return this._position;
  }

  /**
   * Sets the local transformation matrix.
   *
   * Updates the local matrix directly and decomposes it into TRS (keeping Euler/quaternion consistent).
   */
  set matrix(matrix: Mat4) {
    if (this.destroyed) {
      this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneTransform.matrix] Cannot set matrix on destroyed SceneTransform ${this.id}`
      });
      return;
    }
    if (matrix) {
      // @ts-ignore
      this._localMatrix.set(matrix);
    } else {
      identityMat4(this._localMatrix);
    }
    decomposeMat4(this._localMatrix, this._position, this._quaternion, this._scale);
    quatToEuler(this._quaternion, "XYZ", this._rotation);
    this._localMatrixDirty = false;
    this._markTreeDirtyTask.schedule();
  }

  /** Gets the local transformation matrix. */
  get matrix(): Mat4 {
    if (this._localMatrixDirty) {
      composeMat4(
        this._position,
        eulerToQuat(this._rotation, "XYZ", identityQuat()),
        this._scale,
        this._localMatrix
      );
      this._localMatrixDirty = false;
    }
    return this._localMatrix;
  }

  /** Gets the global transformation matrix. */
  get worldMatrix(): Mat4 {
    if (this._worldMatrixDirty) {
      if (this._parentTransform) {
        mulMat4(this._parentTransform.worldMatrix, this.matrix, this._worldMatrix);
      } else {
        mulMat4(this.model.coordinateSystemMatrix, this.matrix, this._worldMatrix);
      }
      this._worldMatrixDirty = false;
    }
    return this._worldMatrix;
  }

  // ------------------------------------------------------------------------------------------------
  // Hierarchy
  // ------------------------------------------------------------------------------------------------

  /** Gets the parent transform, or `null` when this transform is a root. */
  get parentTransform(): SceneTransform | null {
    return this._parentTransform;
  }

  /** Gets direct child transforms of this transform. */
  get childTransforms(): ReadonlyArray<SceneTransform> {
    return this._childTransforms;
  }

  /** Gets direct child meshes of this transform. */
  get childMeshes(): ReadonlyArray<SceneMesh> {
    return this._childMeshes;
  }

  /**
   * Marks this transform globally dirty and propagates that state to all descendants.
   * @internal
   */
  public setWorldMatrixDirty(): void {
    this._worldMatrixDirty = true;
    for (const child of this._childTransforms) {
      child.setWorldMatrixDirty();
    }
    for (const childMesh of this._childMeshes) {
      childMesh.setWorldMatrixDirty();
    }
  }

  /**
   * Attaches/detaches this transform to/from a new parent.
   */
  private _attachParentTransform(parent: SceneTransform | null): void {
    if (this._parentTransform === parent) {
      return;
    }
    if (this._parentTransform) {
      const idx = this._parentTransform._childTransforms.indexOf(this);
      if (idx !== -1) {
        this._parentTransform._childTransforms.splice(idx, 1);
      }
    }
    this._parentTransform = parent;
    if (parent) {
      parent._childTransforms.push(this);
    }
    this._markTreeDirtyTask.schedule();
  }

  /**
   * Sets the parent transform for this transform.
   *
   * @param parentTransformId - ID of the new parent transform, or `null`/`undefined` to unparent.
   * @param opts - Options.
   * @param opts.preserveWorld - When `true`, keeps the world transform unchanged.
   */
  public setParentTransformId(parentTransformId: string, opts?: { preserveWorld?: boolean }): SDKResult<any> {
    if (this.destroyed) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneTransform.setParentTransformId] Cannot set parent transform on destroyed SceneTransform ${this.id}`
      });
    }
    let parentTransform: SceneTransform | null = null;
    if (parentTransformId) {
      if (parentTransformId === this.id) {
        return this.model.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidOperation,
          error: `[SceneTransform.setParentTransformId] Cannot set parent transform to self on SceneTransform ${this.id}`
        });
      }
      parentTransform = this.model.transforms[parentTransformId];
      if (!parentTransform) {
        return this.model.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidOperation,
          error: `[SceneTransform.setParentTransformId] SceneTransform "${parentTransformId}" not found in SceneModel`
        });
      }
      if (parentTransform.model.id !== this.model.id) {
        return this.model.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidOperation,
          error: `[SceneTransform.setParentTransformId] Cannot set parent transform to a transform in a different SceneModel on SceneTransform ${this.id}`
        });
      }
      for (let ancestor = parentTransform; ancestor; ancestor = ancestor._parentTransform) {
        if (ancestor === this) {
          return this.model.scene.logError({
            ok: false,
            type: SDKErrorType.InvalidOperation,
            error: `[SceneTransform.setParentTransformId] Cannot create a transform hierarchy cycle on SceneTransform ${this.id}`
          });
        }
      }
    }
    const preserve = !!opts?.preserveWorld;
    if (preserve) {
      const currentWorld = createMat4Float64(this.worldMatrix);
      this._attachParentTransform(parentTransform);
      if (this._parentTransform) {
        const invParent = inverseMat4(this._parentTransform.worldMatrix, createMat4Float64());
        mulMat4(invParent, currentWorld, this._localMatrix);
      } else {
        const invCoordSystem = inverseMat4(this.model.coordinateSystemMatrix, createMat4Float64());
        mulMat4(invCoordSystem, currentWorld, this._localMatrix);
      }
      this._localMatrixDirty = false;
      this._markTreeDirtyTask.schedule();
    } else {
      this._attachParentTransform(parentTransform);
    }
    return {ok: true, value: undefined};
  }

  /**
   * Adds a child transform to this transform by ID.
   *
   * This resolves the transform from the owning {@link model!scene.SceneModel | SceneModel} and then parents it under this
   * transform (equivalent to `child.setParentTransformId(this, opts)`).
   *
   * @param childTransformId - ID of the child transform to add.
   * @param opts - Options forwarded to {@link setParentTransformId}.
   */
  addChildTransform(childTransformId: string, opts?: { preserveWorld?: boolean }): SDKResult<any> {
    if (this.destroyed) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneTransform.addChildTransform] Cannot add child transform to destroyed SceneTransform ${this.id}`
      });
    }
    const child = this.model.transforms[childTransformId];
    if (!child) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneTransform.addChildTransform] Transform "${childTransformId}" not found in SceneModel`
      });
    }
    return child.setParentTransformId(this.id, opts);
  }

  /**
   * Removes a child transform from this transform by ID (if it is currently parented here).
   *
   * When destroyed, logs an error and returns a failed result.
   *
   * @param childTransformId - ID of the child transform to remove.
   */
  removeChildTransform(childTransformId: string): SDKResult<any> {
    if (this.destroyed) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneTransform.removeChildTransform] Cannot remove child transform from destroyed SceneTransform ${this.id}`
      });
    }
    const child = this.model.transforms[childTransformId];
    if (!child) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneTransform.removeChildTransform] Transform "${childTransformId}" not found in SceneModel`
      });
    }
    if (child._parentTransform === this) {
      child.setParentTransformId(null, {preserveWorld: false});
    }
    return {ok: true, value: undefined};
  }

  /**
   * Adds a child mesh to this transform by ID.
   *
   * This resolves the mesh from the owning {@link model!scene.SceneModel | SceneModel} and then parents it under this transform.
   *
   * When destroyed, logs an error and returns a failed result.
   *
   * @param childMeshId - ID of the mesh to add.
   */
  addChildMesh(childMeshId: string): SDKResult<any> {
    if (this.destroyed) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneTransform.addChildMesh] Cannot add child mesh to destroyed SceneTransform ${this.id}`
      });
    }
    const child = this.model.meshes[childMeshId];
    if (!child) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneTransform.addChildMesh] Mesh "${childMeshId}" not found in SceneModel`
      });
    }
    child.setParentTransformId(this.id);
    return {ok: true, value: undefined};
  }

  /**
   * Removes a child mesh from this transform by ID.
   *
   * @param childMeshId - ID of the mesh to remove.
   */
  removeChildMesh(childMeshId: string): void {
    if (this.destroyed) {
      this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneTransform.removeChildMesh] Cannot remove child mesh from destroyed SceneTransform ${this.id}`
      });
      return;
    }
    const child = this.model.meshes[childMeshId];
    if (!child) {
      this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneTransform.removeChildMesh] Mesh "${childMeshId}" not found in SceneModel`
      });
      return;
    }
    if (child.parentTransform && child.parentTransform.id === this.id) {
      child.setParentTransformId(null);
    }
  }

  /**
   * Updates the cached global matrices for this transform (and recursively for descendants).
   *
   * @private
   */
  private _updateGlobal(force: boolean = false): void {
    if (this._parentTransform) {
      this._parentTransform._updateGlobal(force);
      mulMat4(this._parentTransform._worldMatrix, this._localMatrix, this._worldMatrix);
    } else {
      // Root transform — apply the SceneModel's coord-system pre-multiply,
      // same as the `get worldMatrix()` getter. Previously this branch
      // copied the local matrix directly, which produced a wrong world
      // matrix for any reparenting/preserveWorld path on a model whose
      // basis differed from the scene's.
      mulMat4(this.model.coordinateSystemMatrix, this._localMatrix, this._worldMatrix);
    }
    this._worldMatrixDirty = false;

    for (const child of this._childTransforms) {
      child._updateGlobal(force);
    }
  }

  /**
   * Serializes this transform to {@link SceneTransformParams}.
   *
   * Only writes non-default fields (scale/rotation/position/quaternion/parentTransformId).
   */
  toParams(): SDKResult<SceneTransformParams> {
    if (this.destroyed) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneTransform.toParams] Cannot serialize destroyed SceneTransform ${this.id}`
      });
    }
     const transformParams: SceneTransformParams = {id: this.id};
    transformParams.matrix = <Mat4>Array.from(this.matrix);
    if (this._parentTransform) {
      transformParams.parentTransformId = this._parentTransform.id;
    }
    return {ok: true, value: transformParams};
  }

  /**
   * Destroys this transform.
   *
   * - Detaches from parent
   * - Detaches all child transforms
   * - Removes itself from the owning {@link model!scene.SceneModel | SceneModel}
   */
  destroy(): SDKResult<any> {
    if (this.destroyed) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneTransform.destroy] SceneTransform ${this.id} already destroyed`
      });
    }
    if (this._parentTransform) {
      this._parentTransform.removeChildTransform(this.id);
    }
    this._parentTransform = null;
    for (const child of [...this._childTransforms]) {
      child.setParentTransformId(null, {preserveWorld: false});
    }
    for (const childMesh of [...this._childMeshes]) {
      childMesh.setParentTransformId(null, {preserveWorld: false});
    }
    this._markTreeDirtyTask.destroy();
    this._childTransforms = [];
    this._childMeshes = [];
    this.model._destroyTransform(this);
    this.destroyed = true;
    return {ok: true, value: undefined};
  }

  /**
   * Marks the local matrix dirty and schedules dirtiness propagation through the transform tree.
   */
  private _setLocalDirty(): void {
    this._localMatrixDirty = true;
    this._markTreeDirtyTask.schedule();
  }


}
