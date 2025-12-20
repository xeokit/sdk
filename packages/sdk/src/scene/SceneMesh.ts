import {
  createMat4Float64,
  createVec4Float64,
  type Mat4,
  type Vec3Float,
  identityMat4,
  inverseMat4,
  isIdentityMat4,
  mulMat4,
  type Vec4Float
} from "../math";
import type {FloatArrayParam} from "../math";
import type {SceneGeometry} from "./SceneGeometry";
import type {SceneMeshParams} from "./SceneMeshParams";
import type {SceneObject} from "./SceneObject";
import type {SceneTextureSet} from "./SceneTextureSet";
import type {SceneModel} from "./SceneModel";
import {SceneTransform} from "./SceneTransform";
import { SDKErrorType, type SDKResult} from "../core";


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
   * The SceneModel that contains this SceneMesh.
   */
  readonly model: SceneModel;

  /**
   * The {@link SceneObject} that uses this SceneMesh.
   */
  object: SceneObject|null;

  /**
   * {@link SceneGeometry} used by this SceneMesh.
   */
  readonly geometry: SceneGeometry;

  /**
   * {@link SceneTextureSet} used by this SceneMesh.
   */
  readonly textureSet?: SceneTextureSet;

  private _color: Vec4Float;
  private _opacity: number;
  private _localMatrix: Mat4;
  private _globalMatrix: Mat4;
  private _parentTransform: SceneTransform | null = null;

   destroyed: boolean = false;

  /**
   * @private
   */
  constructor( meshParams: {
    id: string;
    model: SceneModel;
    geometry: SceneGeometry;
    textureSet?: SceneTextureSet;
    matrix?: Mat4;
    color?: Vec3Float;
    opacity?: number;
  } ) {
    this.id = meshParams.id;
    this.model = meshParams.model;
    this._localMatrix = meshParams.matrix ? createMat4Float64(meshParams.matrix) : identityMat4();
    this._globalMatrix = createMat4Float64();
    this.geometry = meshParams.geometry;
    this.textureSet = meshParams.textureSet;
    this.color = meshParams.color || [1, 1, 1];    // FIXME: This fires update events during construction
    this.opacity = (meshParams.opacity !== undefined && meshParams.opacity !== null) ? meshParams.opacity : 1.0;
    this.object = null;
  }

  /**
   * Gets the RGB color for this SceneMesh.
   *
   * Each element of the color is in range ````[0..1]````.
   */
  get color(): Vec4Float {
    return this._color;
  }

  /**
   * Sets the RGB color for this SceneMesh.
   *
   * Each element of the color is in range ````[0..1]````.
   */
  set color( value: Vec3Float ) {
    if (this.destroyed) {
      this.model.scene.logError( {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneMesh.color] Cannot set color on destroyed SceneMesh ${this.id}`
      });
      return;
    }
    if (!value || value.length < 3){
      this.model.scene.logError( {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[SceneMesh.color] Invalid color for SceneMesh ${this.id}`
      });
      return;
    }
    let color = this._color;
    if (!color) {
      color = this._color = createVec4Float64();
        color[3] = 1;
    }
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
   * Updates this SceneMesh's local modeling transform matrix.
   *
   * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
   *
   * @type {FloatArrayParam}
   */
  set matrix( matrix: Mat4 ) {
    if (this.destroyed) {
      this.model.scene.logError( {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneMesh.matrix] Cannot set matrix on destroyed SceneMesh ${this.id}`
      });
      return;
    }
    if (!matrix || matrix.length !== 16) {
      this.model.scene.logError( {
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
    this._updateGlobal();
    this.model.scene.events.onSceneMeshMatrixChanged.dispatch(this.model.scene, this);
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
  get globalMatrix(): Mat4 {
    this._updateGlobal();
    return this._globalMatrix;
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
   * This is a factor in range ````[0..1]````.
   */
  set opacity( opacity: number ) {
    if (this.destroyed) {
      this.model.scene.logError( {
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
   * Gets the parent {@link SceneTransform} of this SceneMesh, or ````null```` if this SceneMesh is not parented.
   */
  get parentTransform(): SceneTransform | null {
    return this._parentTransform;
  }

  /**
   * Updates the global transform matrix.
   * @private
   */
   _updateGlobal(): void {
    if (this._parentTransform) {
      mulMat4( this._parentTransform.globalMatrix, this._localMatrix, this._globalMatrix);
    } else {
      // @ts-ignore
      this._globalMatrix.set(this._localMatrix);
    }
    const scene = this.model.scene;
      // TODO: recompute AABBs using coordinateSystemMatrix

      // Transforms are in the coordinate system of the model
      // const coordSystemAndModelingMatrix = mulMat4(this.model.coordinateSystemMatrix, this._globalMatrix, tempMat4);
      // scene.events.meshMatrix.dispatch(scene, this);
      // scene.events.meshMoved.dispatch(scene, this);
  }

  // /**
  //  * Sets the {@link SceneTransform} that is the parent of this SceneMesh.
  //  * @param parent
  //  */
  // setParentTransformOLD(parent: SceneTransform | null): void {
  //   if (this._parentTransform === parent) {
  //     return;
  //   }
  //   if (this._parentTransform) {
  //     this._parentTransform.removeChildMesh(this);
  //   }
  //   this._parentTransform = parent;
  //   if (parent) {
  //     parent.addChildMesh(this);
  //   }
  //   this._updateGlobal();
  // }

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
    this._updateGlobal();
  }

  /**
   * Sets the parent transform for this mesh.
   * @param next - The new parent transform or null to detach.
   * @param opts - Options to preserve world transformation.
   */
  public setParentTransform(next: SceneTransform | null, opts?: { preserveWorld?: boolean }): void {
    if (this.destroyed) {
      return;
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
      this._updateGlobal();
    } else {
      this._attachParentTransform(next);
    }
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
      meshParams.matrix = Array.from(this._localMatrix);
    }
    if (this.textureSet !== undefined) {
      meshParams.textureSetId = this.textureSet.id;
    }
    if (this._parentTransform !== undefined) {
      meshParams.parentTransformId = this.parentTransform.id;
    }
    return {
      ok: true,
      value: meshParams
    };
  }

  /**
   * Destroys this SceneMesh.
   */
  destroy(): SDKResult<void>  {
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
      this._parentTransform.removeChildMesh(this);
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
