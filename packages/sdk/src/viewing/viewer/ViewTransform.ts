import {
  composeMat4,
  createMat4Float64,
  decomposeMat4,
  identityMat4,
  inverseMat4,
  mulMat4,
  type Mat4
} from "../../base/math/matrix";

import { SDKErrorType, type SDKResult, SDKTask } from "../../base/core";

import { createVec3Float64, type Vec3 } from "../../base/math/vector";
import {
  createQuatFloat64,
  eulerToQuat,
  identityQuat,
  quatToEuler,
  type Quat
} from "../../base/math/quat";

import type { View } from "./View";
import type { ViewLayer } from "./ViewLayer";
import type { ViewObject } from "./ViewObject";

import type {SceneObject, SceneMesh} from "../../model/scene";

/**
 * Represents a per-View transform that can be applied at render time without modifying the Scene.
 *
 * View transforms live in a {@link viewing!viewer.View | View} or {@link ViewLayer} and can be composed into a hierarchy.
 * A {@link ViewTransform} is typically associated with one or more {@link viewing!viewer.ViewObject | ViewObject}s, enabling
 * per-view object manipulation while leaving the underlying {@link model!scene.SceneObject | SceneObject}/{@link model!scene.SceneMesh | SceneMesh} transforms intact.
 *
 * @remarks
 * The renderer combines the Scene transform product with the View transform product in the shader.
 * This class assumes the View product post-multiplies the Scene product:
 *
 * `modelMatrix = sceneMatrix * worldMatrix`
 */
export class ViewTransform {
  /** Unique identifier for this transform within its owning {@link viewing!viewer.View | View} or {@link ViewLayer}. */
  readonly id: string;

  /** Owning {@link viewing!viewer.View | View}. */
  readonly view: View;

  /** Owning {@link ViewLayer}, when the transform is layer-scoped. */
  readonly layer: ViewLayer | null;

  private _scale: Vec3 = createVec3Float64([1, 1, 1]);
  private _rotation: Vec3 = createVec3Float64([0, 0, 0]);
  private _position: Vec3 = createVec3Float64([0, 0, 0]);
  private _quaternion: Quat = createQuatFloat64();

  private _localMatrix: Mat4 = identityMat4();
  private _worldMatrix: Mat4;

  private _localMatrixDirty = false;
  private _worldMatrixDirty = true;

  private _childTransforms: ViewTransform[] = [];
  private _parentTransform: ViewTransform | null = null;

  /** ViewObject IDs associated with this transform. */
  private _viewObjectIds: Set<string> = new Set();

  /** True once {@link destroy} has been called. */
  public destroyed = false;

  private _markTreeDirtyTask: SDKTask;

  /**
   * @private
   */
  constructor(
    view: View,
    params: {
      id: string;
      layer?: ViewLayer | null;

      matrix?: Mat4;
      position?: Vec3;
      rotation?: Vec3;
      quaternion?: Quat;
      scale?: Vec3;

      parentTransformId?: string | null;

      /** Optional initial associations. */
      viewObjectIds?: string[];
    }
  ) {
    this.id = params.id;
    this.view = view;
    this.layer = params.layer ?? null;

    this._localMatrix = params.matrix ? createMat4Float64(params.matrix) : identityMat4();
    this._worldMatrix = createMat4Float64();

    this._markTreeDirtyTask = new SDKTask({
      name: "ViewTransform._markTreeDirtyTask",
      stage: SDKTask.ComputeStage,
      task: () => this._markTransformDirty()
    });

    if (params.matrix) {
      this.matrix = params.matrix;
    } else {
      this.scale = params.scale;
      this.position = params.position;

      if (params.quaternion) {
        this.quaternion = params.quaternion;
      } else {
        this.rotation = params.rotation;
      }
    }

    if (params.parentTransformId) {
      this.setParentTransformId(params.parentTransformId, { preserveWorld: false });
    }

    if (params.viewObjectIds?.length) {
      for (const id of params.viewObjectIds) {
        this._viewObjectIds.add(id);
      }
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Local TRS
  // ---------------------------------------------------------------------------------------------

  set scale(scale: Vec3) {
    if (this.destroyed) {
      this._logDestroyed("[ViewTransform.scale] Cannot set scale on destroyed ViewTransform");
      return;
    }
    // @ts-ignore
    this._scale.set(scale ?? [1, 1, 1]);
    this._setLocalDirty();
  }

  get scale(): Vec3 {
    return this._scale;
  }

  set rotation(rotation: Vec3) {
    if (this.destroyed) {
      this._logDestroyed("[ViewTransform.rotation] Cannot set rotation on destroyed ViewTransform");
      return;
    }
    // @ts-ignore
    this._rotation.set(rotation ?? [0, 0, 0]);
    eulerToQuat(this._rotation, "XYZ", this._quaternion);
    this._setLocalDirty();
  }

  get rotation(): Vec3 {
    return this._rotation;
  }

  set quaternion(quaternion: Quat) {
    if (this.destroyed) {
      this._logDestroyed("[ViewTransform.quaternion] Cannot set quaternion on destroyed ViewTransform");
      return;
    }
    // @ts-ignore
    this._quaternion.set(quaternion);
    quatToEuler(this._quaternion, "XYZ", this._rotation);
    this._setLocalDirty();
  }

  get quaternion(): Quat {
    return this._quaternion;
  }

  set position(position: Vec3) {
    if (this.destroyed) {
      this._logDestroyed("[ViewTransform.position] Cannot set position on destroyed ViewTransform");
      return;
    }
    // @ts-ignore
    this._position.set(position ?? [0, 0, 0]);
    this._setLocalDirty();
  }

  get position(): Vec3 {
    return this._position;
  }

  // ---------------------------------------------------------------------------------------------
  // Matrices
  // ---------------------------------------------------------------------------------------------

  set matrix(matrix: Mat4) {
    if (this.destroyed) {
      this._logDestroyed("[ViewTransform.matrix] Cannot set matrix on destroyed ViewTransform");
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

  /**
   * Returns the composed transform matrix for this node within the ViewTransform hierarchy.
   * Intended for renderer use when building the per-object view transform product.
   */
  get worldMatrix(): Mat4 {
    if (this._worldMatrixDirty) {
      if (this._parentTransform) {
        mulMat4(this._parentTransform.worldMatrix, this.matrix, this._worldMatrix);
      } else {
        // @ts-ignore
        this._worldMatrix.set(this.matrix);
      }
      this._worldMatrixDirty = false;
    }
    return this._worldMatrix;
  }

  // ---------------------------------------------------------------------------------------------
  // Hierarchy
  // ---------------------------------------------------------------------------------------------

  get parentTransform(): ViewTransform | null {
    return this._parentTransform;
  }

  get childTransforms(): ReadonlyArray<ViewTransform> {
    return this._childTransforms;
  }

  private _markTransformDirty(): void {
    this._worldMatrixDirty = true;
    for (const child of this._childTransforms) {
      child._markTransformDirty();
    }
  }

  private _attachParentTransform(parent: ViewTransform | null): void {
    if (this._parentTransform === parent) return;

    if (this._parentTransform) {
      const i = this._parentTransform._childTransforms.indexOf(this);
      if (i !== -1) this._parentTransform._childTransforms.splice(i, 1);
    }

    this._parentTransform = parent;
    if (parent) parent._childTransforms.push(this);

    this._markTreeDirtyTask.schedule();
  }

  public setParentTransformId(
    parentTransformId: string | null,
    opts?: { preserveWorld?: boolean }
  ): SDKResult<any> {
    if (this.destroyed) {
      return this._logErrorResult(
        "[ViewTransform.setParentTransformId] Cannot set parent transform on destroyed ViewTransform"
      );
    }

    let parent: ViewTransform | null = null;

    if (parentTransformId) {
      if (parentTransformId === this.id) {
        return this._logErrorResult(
          `[ViewTransform.setParentTransformId] Cannot set parent transform to self on ViewTransform ${this.id}`
        );
      }

      parent = this._resolveTransform(parentTransformId);
      if (!parent) {
        return this._logErrorResult(
          `[ViewTransform.setParentTransformId] ViewTransform "${parentTransformId}" not found in owning scope`
        );
      }
    }

    const preserve = !!opts?.preserveWorld;

    if (preserve) {
      this._updateGlobal();
      const currentWorld = createMat4Float64(this._worldMatrix);

      this._attachParentTransform(parent);

      if (this._parentTransform) {
        const invParent = inverseMat4(this._parentTransform._worldMatrix, createMat4Float64());
        mulMat4(invParent, currentWorld, this._localMatrix);
      } else {
        // @ts-ignore
        this._localMatrix.set(currentWorld);
      }

      this._markTreeDirtyTask.schedule();
    } else {
      this._attachParentTransform(parent);
    }

    return { ok: true, value: undefined };
  }

  public addChildTransform(childTransformId: string, opts?: { preserveWorld?: boolean }): SDKResult<any> {
    if (this.destroyed) {
      return this._logErrorResult(
        `[ViewTransform.addChildTransform] Cannot add child transform to destroyed ViewTransform ${this.id}`
      );
    }

    const child = this._resolveTransform(childTransformId);
    if (!child) {
      return this._logErrorResult(
        `[ViewTransform.addChildTransform] ViewTransform "${childTransformId}" not found in owning scope`
      );
    }

    return child.setParentTransformId(this.id, opts);
  }

  public removeChildTransform(childTransformId: string): SDKResult<any> {
    if (this.destroyed) {
      return this._logErrorResult(
        `[ViewTransform.removeChildTransform] Cannot remove child transform from destroyed ViewTransform ${this.id}`
      );
    }

    const child = this._resolveTransform(childTransformId);
    if (!child) {
      return this._logErrorResult(
        `[ViewTransform.removeChildTransform] ViewTransform "${childTransformId}" not found in owning scope`
      );
    }

    if (child._parentTransform === this) {
      child.setParentTransformId(null, { preserveWorld: false });
    }

    return { ok: true, value: undefined };
  }

  // ---------------------------------------------------------------------------------------------
  // ViewObject association
  // ---------------------------------------------------------------------------------------------

  /**
   * Associates a {@link viewing!viewer.ViewObject | ViewObject} (by ID) with this transform.
   *
   * The owning {@link viewing!viewer.View | View}/{@link ViewLayer} is expected to use this association to apply
   * the transform product to the ViewObject at render time.
   */
  public attachViewObject(viewObjectId: string): SDKResult<any> {
    if (this.destroyed) {
      return this._logErrorResult(
        `[ViewTransform.attachViewObject] Cannot attach ViewObject to destroyed ViewTransform ${this.id}`
      );
    }
    if (!viewObjectId) {
      return this._logErrorResult("[ViewTransform.attachViewObject] viewObjectId is required");
    }

    const vo = this._resolveViewObject(viewObjectId);
    if (!vo) {
      return this._logErrorResult(
        `[ViewTransform.attachViewObject] ViewObject "${viewObjectId}" not found in owning scope`
      );
    }

    this._viewObjectIds.add(viewObjectId);
    return { ok: true, value: undefined };
  }

  /**
   * Removes an association created by {@link attachViewObject}.
   */
  public detachViewObject(viewObjectId: string): SDKResult<any> {
    if (this.destroyed) {
      return this._logErrorResult(
        `[ViewTransform.detachViewObject] Cannot detach ViewObject from destroyed ViewTransform ${this.id}`
      );
    }
    this._viewObjectIds.delete(viewObjectId);
    return { ok: true, value: undefined };
  }

  /**
   * Gets associated {@link viewing!viewer.ViewObject | ViewObject} IDs.
   * Intended for renderer integration.
   */
  get viewObjectIds(): ReadonlySet<string> {
    return this._viewObjectIds;
  }

  // ---------------------------------------------------------------------------------------------
  // Internal / renderer integration
  // ---------------------------------------------------------------------------------------------

  /** @private */
  _updateGlobal(force: boolean = false): void {
    if (this._parentTransform) {
      this._parentTransform._updateGlobal(force);
      mulMat4(this._parentTransform._worldMatrix, this._localMatrix, this._worldMatrix);
    } else {
      // @ts-ignore
      this._worldMatrix.set(this._localMatrix);
    }

    this._worldMatrixDirty = false;

    for (const child of this._childTransforms) {
      child._updateGlobal(force);
    }

    // TODO: update ViewObjects associated with this transform, if any
  }

  /**
   * Destroys this transform, detaching it from the hierarchy.
   * Owning View/ViewLayer should remove it from registries and unlink ViewObjects.
   */
  destroy(): SDKResult<any> {
    if (this.destroyed) {
      return this._logErrorResult(`[ViewTransform.destroy] ViewTransform ${this.id} already destroyed`);
    }

    if (this._parentTransform) {
      this._parentTransform.removeChildTransform(this.id);
    }

    this._parentTransform = null;

    for (const child of [...this._childTransforms]) {
      child.setParentTransformId(null, { preserveWorld: false });
    }

    this._markTreeDirtyTask.destroy();
    this._childTransforms = [];
    this._viewObjectIds.clear();

    this.destroyed = true;
    return { ok: true, value: undefined };
  }

  // ---------------------------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------------------------

  private _setLocalDirty(): void {
    this._localMatrixDirty = true;
    this._markTreeDirtyTask.schedule();
  }

  private _resolveTransform(id: string): ViewTransform | null {
    // Expected registry lookup on owning scope.
    const layerAny = this.layer as any;
    const viewAny = this.view as any;

    if (layerAny?.transforms?.[id]) return layerAny.transforms[id];
    if (viewAny?.transforms?.[id]) return viewAny.transforms[id];

    return null;
  }

  private _resolveViewObject(id: string): ViewObject | null {
    // Expected registry lookup on owning scope.
    const layerAny = this.layer as any;
    const viewAny = this.view as any;

    if (layerAny?.objects?.[id]) return layerAny.objects[id];
    if (viewAny?.objects?.[id]) return viewAny.objects[id];

    return null;
  }

  private _logDestroyed(msg: string): void {
    const viewAny = this.view as any;
    if (viewAny?.logError) {
      viewAny.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `${msg} ${this.id}`
      });
      return;
    }
    // eslint-disable-next-line no-console
    console.error(msg, this.id);
  }

  private _logErrorResult(error: string): SDKResult<any> {
    const viewAny = this.view as any;
    if (viewAny?.logError) {
      return viewAny.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error
      });
    }
    return { ok: false, error } as any;
  }
}
