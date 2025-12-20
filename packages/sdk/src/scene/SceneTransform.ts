import {createMat4Float64, type Mat4, identityMat4, inverseMat4, mulMat4} from "../math";

import type {SceneTransformParams} from "./SceneTransformParams";
import type {SceneModel} from "./SceneModel";
import type {SceneMesh} from "./SceneMesh";

/**
 * A transform within a {@link SceneModel | SceneModel}.
 *
 * * Stored in {@link SceneModel.transforms | SceneModel.transforms}
 * * Created with {@link SceneModel.createTransform | SceneModel.createrTransform}
 * * Can be connected into a transform hierarchy with parent and child transforms
 *
 * See {@link scene | @xeokit/sdk/scene}   for usage.
 */
export class SceneTransform {

  /** Unique identifier for the SceneTransform */
  readonly id: string;

  /** Reference to the SceneModel this transform belongs to */
  readonly model: SceneModel;

  /** Local transformation matrix */
  private _localMatrix: Mat4;

  /** Global transformation matrix */
  _globalMatrix: Mat4;

  /** Flag indicating if the transform is dirty and needs updating */
  private _dirty: boolean = true;

  /** List of child SceneMesh objects */
  _childMeshes: SceneMesh[] = [];

  /** List of child SceneTransform objects */
  private _childTransforms: SceneTransform[] = [];

  /** Reference to the parent SceneTransform, if any */
  private _parentTransform: SceneTransform | null = null;

  /**
   * True if this SceneTransform has been destroyed.
   */
  public destroyed: boolean = false;

  /**
   * Creates a new SceneTransform instance.
   * @param model - The SceneModel this transform belongs to.
   * @param transformParams - Parameters for initializing the transform.
   */
  constructor(model: SceneModel, transformParams: SceneTransformParams) {
    this.id = transformParams.id;
    this.model = model;
    this._localMatrix = transformParams.matrix ? createMat4Float64(transformParams.matrix) : identityMat4();
    this._globalMatrix = createMat4Float64();
  }

  /**
   * Sets the local transformation matrix.
   * @param matrix - The new local matrix.
   */
  set matrix(matrix: Mat4) {
    if (matrix) {
      // @ts-ignore
      this._localMatrix.set(matrix);
    } else {
      identityMat4(this._localMatrix);
    }
    this._markTransformDirty();
    this.model.scene.events.onSceneTransformMatrixChanged.dispatch(this.model.scene, this);
  }

  /**
   * Gets the local transformation matrix.
   * @returns The local matrix.
   */
  get matrix(): Mat4 {
    return this._localMatrix;
  }

  /**
   * Gets the global transformation matrix.
   * Updates the global matrix if necessary.
   * @returns The global matrix.
   */
  get globalMatrix(): Mat4 {
    this._updateGlobal();
    return this._globalMatrix;
  }

  /**
   * Gets the parent SceneTransform.
   * @returns The parent transform or null if none exists.
   */
  get parentTransform(): SceneTransform | null {
    return this._parentTransform;
  }

  /**
   * Gets the list of child SceneTransform objects.
   * @returns A readonly array of child transforms.
   */
  get childTransforms(): ReadonlyArray<SceneTransform> {
    return this._childTransforms;
  }

  /**
   * Gets the list of child SceneMesh objects.
   * @returns A readonly array of child meshes.
   */
  get childMeshes(): ReadonlyArray<SceneMesh> {
    return this._childMeshes;
  }

  /**
   * Marks the transform and its children as dirty, requiring updates.
   */
  private _markTransformDirty(): void {
    //if (!this._dirty) {
      this._dirty = true;
      for (const child of this._childTransforms) {
        child._markTransformDirty();
      }
      for (const child of this._childMeshes) {
        child._updateGlobal(); // Immediately uploads mesh matrix to renderer
      }
   // }
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
      const idx = this._parentTransform._childTransforms.indexOf(this);
      if (idx !== -1) {
        this._parentTransform._childTransforms.splice(idx, 1);
      }
    }
    this._parentTransform = parent;
    if (parent) {
      parent._childTransforms.push(this);
    }
    this._markTransformDirty();
  }

  /**
   * Sets the parent transform for this transform.
   * @param next - The new parent transform or null to detach.
   * @param opts - Options to preserve world transformation.
   */
  public setParentTransform(next: SceneTransform | null, opts?: { preserveWorld?: boolean }): void {
    if (next === this) {
      throw new Error("Cannot parent to self");
    }
    const preserve = !!opts?.preserveWorld;
    if (preserve) {
      this._updateGlobal();
      const currentWorld = createMat4Float64(this._globalMatrix);
      this._attachParentTransform(next);
      if (this._parentTransform) {
        const invParent = inverseMat4(this._parentTransform._globalMatrix, createMat4Float64());
        mulMat4(this._localMatrix, invParent, currentWorld);
      } else {
        // @ts-ignore
        this._localMatrix.set(currentWorld);
      }
      this._markTransformDirty();
    } else {
      this._attachParentTransform(next);
    }
  }

  /**
   * Adds a child transform to this transform.
   * @param child - The child transform to add.
   * @param opts - Options to preserve world transformation.
   */
  addChildTransform(child: SceneTransform, opts?: { preserveWorld?: boolean }): void {
    child.setParentTransform(this, opts);
  }

  /**
   * Removes a child transform from this transform.
   * @param child - The child transform to remove.
   */
  removeChildTransform(child: SceneTransform): void {
    if (child._parentTransform === this) {
      child.setParentTransform(null, { preserveWorld: false });
    }
  }

  /**
   * Adds a child mesh to this transform.
   * @param child - The child mesh to add.
   */
  addChildMesh(child: SceneMesh): void {
    child.setParentTransform(this);
  }

  /**
   * Removes a child mesh from this transform.
   * @param child - The child mesh to remove.
   */
  removeChildMesh(child: SceneMesh): void {
    // if (child._parentTransform === this) {
    //   child.setParentTransform(null);
    // }
  }

  /**
   * Updates the global transformation matrix.
   * @param force - Whether to force the update.
   */
   _updateGlobal(force:boolean = false): void {
    if (force || this._dirty) {
      if (this._parentTransform) {
        this._parentTransform._updateGlobal(force);
        mulMat4( this._parentTransform._globalMatrix, this._localMatrix, this._globalMatrix);
      } else {
        // @ts-ignore
        this._globalMatrix.set(this._localMatrix);
      }
      this._dirty = false;
    }

    for (const child of this._childTransforms) {
      child._updateGlobal(force);
    }
  }

  /**
   * Converts the transform to its parameter representation.
   * @returns The transform parameters.
   */
  toParams(): SceneTransformParams {
    const transformParams: SceneTransformParams = {
      id: this.id,
      matrix: Array.from(this._localMatrix),
    };
    if (this._parentTransform) {
      transformParams.parentTransformId = this._parentTransform.id;
    }
    return transformParams;
  }

  /**
   * Destroys the transform, detaching it from its parent and children.
   */
  destroy(): void {
    if (this.destroyed) {
         }
    if (this._parentTransform) {
      this._parentTransform.removeChildTransform(this);
    }
    this._parentTransform = null;
    for (const child of [...this._childTransforms]) {
      child.setParentTransform(null, { preserveWorld: false });
    }
    this._childTransforms = [];
    this.model._destroyTransform(this);
    this.destroyed = true;
  }
}
