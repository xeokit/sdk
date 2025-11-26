import {EventEmitter, SDKErrorType, SDKResult} from "../core";
import {createMat4, frustumMat4, inverseMat4, mulMat4v4, mulVec3Scalar, transposeMat4} from "../matrix";
import type {Camera} from "./Camera";
import {EventDispatcher} from "strongly-typed-events";
import type {FloatArrayParam} from "../math";
import type {FrustumProjectionParams} from "./FrustumProjectionParams";
import {FrustumProjectionType} from "../constants";
import type {Projection} from "./Projection";
import {SDKTask} from "../core/SDKTask";

/**
 *  FrustumProjection-based perspective projection configuration for a {@link Camera | Camera} .
 *
 * * Located at {@link Camera.frustumProjection}.
 * * Allows to explicitly set the positions of the left, right, top, bottom, near and far planes, which is useful for asymmetrical view volumes, such as for stereo viewing.
 * * {@link FrustumProjection.near} and {@link FrustumProjection.far} specify the distances to the clipping planes.
 * * {@link FrustumProjection.onProjMatrix} will fire an event whenever {@link FrustumProjection.projMatrix} updates, which indicates that one or more other properties have updated.
 */
export class FrustumProjection implements Projection {

  /**
   * The task that updates the projection matrix.
   * @private
   */
  private _rebuildMatricesTask: SDKTask;

  /**
   * The type of this projection.
   */
  static readonly type: number = FrustumProjectionType;

  /**
   * The Camera this FrustumProjection belongs to.
   */
  public readonly camera: Camera;

  /**
   * Emits an event each time {@link FrustumProjection.projMatrix} updates.
   *
   * @private
   */
  readonly onProjMatrix: EventEmitter<FrustumProjection, FloatArrayParam>;

  private _far: number;
  private _near: number;
  private _left: number;
  private _right: number;
  private _bottom: number;
  private _top: number;
  private _projMatrix: FloatArrayParam;
  private _inverseProjMatrix: FloatArrayParam;
  private _transposedProjMatrix: FloatArrayParam;
  private _inverseMatrixDirty: boolean;
  private _transposedProjMatrixDirty: boolean;
  private _destroyed: boolean = false;

  /**
   * @private
   */
  constructor(camera: Camera, cfg: FrustumProjectionParams = {}) {

    this.camera = camera;

    this._projMatrix = createMat4();
    this._inverseProjMatrix = createMat4();
    this._transposedProjMatrix = createMat4();
    this._near = 0.1;
    this._far = 10000.0;
    this._left = (cfg.left !== undefined && cfg.left !== null) ? cfg.left : -1.0;
    this._right = (cfg.right !== undefined && cfg.right !== null) ? cfg.right : 1.0;
    this._bottom = (cfg.bottom !== undefined && cfg.bottom !== null) ? cfg.bottom : -1.0;
    this._top = (cfg.top !== undefined && cfg.top !== null) ? cfg.top : 1.0;

    this.onProjMatrix = new EventEmitter(new EventDispatcher<FrustumProjection, FloatArrayParam>());

    this._inverseMatrixDirty = true;
    this._transposedProjMatrixDirty = true;

    this._rebuildMatricesTask = new SDKTask(() => {
      frustumMat4(this._left, this._right, this._bottom, this._top, this._near, this._far, this.projMatrix);
      this._inverseMatrixDirty = true;
      this._transposedProjMatrixDirty = true;
      this.onProjMatrix.dispatch(this, this.projMatrix);
    }, SDKTask.PHASE_0);
  }

  /**
   * Gets the position of the FrustumProjection's left plane on the View-space X-axis.
   *
   * @return {Number} Left frustum plane position.
   */
  get left(): number {
    return this._left;
  }

  /**
   * Sets the position of the FrustumProjection's left plane on the View-space X-axis.
   *
   * @param value New left frustum plane position.
   */
  set left(value: number) {
    this._left = value;
    this._rebuildMatricesTask.schedule();
  }

  /**
   * Gets the position of the FrustumProjection's right plane on the View-space X-axis.
   *
   * @return {Number} Right frustum plane position.
   */
  get right(): number {
    return this._right;
  }

  /**
   * Sets the position of the FrustumProjection's right plane on the View-space X-axis.
   *
   * @param value New right frustum plane position.
   */
  set right(value: number) {
    this._right = value
    this._rebuildMatricesTask.schedule();
  }

  /**
   * Gets the position of the FrustumProjection's top plane on the View-space Y-axis.
   *
   * @return {Number} Top frustum plane position.
   */
  get top(): number {
    return this._top;
  }

  /**
   * Sets the position of the FrustumProjection's top plane on the View-space Y-axis.
   *
   * @param value New top frustum plane position.
   */
  set top(value: number) {
    this._top = value
    this._rebuildMatricesTask.schedule();
  }

  /**
   * Gets the position of the FrustumProjection's bottom plane on the View-space Y-axis.
   *
   * @return {Number} Bottom frustum plane position.
   */
  get bottom(): number {
    return this._bottom;
  }

  /**
   * Sets the position of the FrustumProjection's bottom plane on the View-space Y-axis.
   *
   * @param value New bottom frustum plane position.
   */
  set bottom(value: number) {
    this._bottom = value
    this._rebuildMatricesTask.schedule();
  }

  /**
   * Gets the position of the FrustumProjection's near plane on the positive View-space Z-axis.
   *
   * Default value is ````0.1````.
   *
   * @return {Number} Near frustum plane position.
   */
  get near(): number {
    return this._near;
  }

  /**
   * Sets the position of the FrustumProjection's near plane on the positive View-space Z-axis.
   *
   * Default value is ````0.1````.
   *
   * @param value New FrustumProjection near plane position.
   */
  set near(value: number) {
    this._near = value
    this._rebuildMatricesTask.schedule();
  }

  /**
   * Gets the position of the FrustumProjection's far plane on the positive View-space Z-axis.
   *
   * Default value is ````10000.0````.
   *
   * @return {Number} Far frustum plane position.
   */
  get far(): number {
    return this._far;
  }

  /**
   * Sets the position of the FrustumProjection's far plane on the positive View-space Z-axis.
   *
   * Default value is ````10000.0````.
   *
   * @param value New far frustum plane position.
   */
  set far(value: number) {
    this._far = value
    this._rebuildMatricesTask.schedule();
  }

  /**
   * Gets the FrustumProjection's projection transform matrix.
   *
   * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
   *
   * @returns The FrustumProjection's projection matrix
   */
  get projMatrix(): FloatArrayParam {
    if (this._rebuildMatricesTask.scheduled) {
      this._rebuildMatricesTask.runIfScheduled();
    }
    return this._projMatrix;
  }

  /**
   * Gets the inverse of {@link FrustumProjection.projMatrix}.
   *
   * @returns  The inverse orthographic projection projMatrix.
   */
  get inverseProjMatrix(): FloatArrayParam {
    if (this._rebuildMatricesTask.scheduled) {
      this._rebuildMatricesTask.runIfScheduled();
    }
    if (this._inverseMatrixDirty) {
      inverseMat4(this.projMatrix, this._inverseProjMatrix);
      this._inverseMatrixDirty = false;
    }
    return this._inverseProjMatrix;
  }

  /**
   * Gets the transpose of {@link FrustumProjection.projMatrix}.
   *
   * @returns The transpose of {@link FrustumProjection.projMatrix}.
   */
  get transposedProjMatrix(): FloatArrayParam {
    if (this._rebuildMatricesTask.scheduled) {
      this._rebuildMatricesTask.runIfScheduled();
    }
    if (this._transposedProjMatrixDirty) {
      transposeMat4(this.projMatrix, this._transposedProjMatrix);
      this._transposedProjMatrixDirty = false;
    }
    return this._transposedProjMatrix;
  }

  /**
   * Un-projects the given View-space coordinates, using this FrustumProjection projection.
   *
   * @param canvasPos Inputs 2D View-space coordinates.
   * @param screenZ Inputs Screen-space Z coordinate.
   * @param screenPos Outputs 3D Screen/Clip-space coordinates.
   * @param viewPos Outputs un-projected 3D View-space coordinates.
   * @param worldPos Outputs un-projected 3D World-space coordinates.
   */
  unproject(
    canvasPos: FloatArrayParam,
    screenZ: number,
    screenPos: FloatArrayParam,
    viewPos: FloatArrayParam,
    worldPos: FloatArrayParam): FloatArrayParam {

    const htmlElement = this.camera.view.htmlElement;

    const halfViewWidth = htmlElement.offsetWidth / 2.0;
    const halfViewHeight = htmlElement.offsetHeight / 2.0;

    screenPos[0] = (canvasPos[0] - halfViewWidth) / halfViewWidth;
    screenPos[1] = (canvasPos[1] - halfViewHeight) / halfViewHeight;
    screenPos[2] = screenZ;
    screenPos[3] = 1.0;

    mulMat4v4(this.inverseProjMatrix, screenPos, viewPos);
    mulVec3Scalar(viewPos, 1.0 / viewPos[3]);

    viewPos[3] = 1.0;
    viewPos[1] *= -1;

    mulMat4v4(this.camera.inverseViewMatrix, viewPos, worldPos);

    return worldPos;
  }

  /**
   * Configures this FrustumProjection.
   *
   * @param frustumProjectionParams
   */
  fromParams(frustumProjectionParams: FrustumProjectionParams): SDKResult<any, string> {
    if (this._destroyed) {
      return this.camera.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[FrustumProjection.fromParams] FrustumProjection has been destroyed."
      });
    }
    if (frustumProjectionParams.far !== undefined) {
      this._far = frustumProjectionParams.far;
    }
    if (frustumProjectionParams.near !== undefined) {
      this._near = frustumProjectionParams.near;
    }
    if (frustumProjectionParams.top !== undefined) {
      this._top = frustumProjectionParams.top;
    }
    if (frustumProjectionParams.bottom !== undefined) {
      this._bottom = frustumProjectionParams.bottom;
    }
    if (frustumProjectionParams.right !== undefined) {
      this._right = frustumProjectionParams.right;
    }
    if (frustumProjectionParams.left !== undefined) {
      this._left = frustumProjectionParams.left;
    }
    this._rebuildMatricesTask.schedule();
    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Gets the current configuration of this FrustumProjection.
   */
  toParams(): SDKResult<FrustumProjectionParams, string> {
    if (this._destroyed) {
      return this.camera.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[FrustumProjection.toParams] FrustumProjection has been destroyed."
      });
    }
    return {
      ok: true,
      value: {
        far: this._far,
        near: this._near,
        top: this._top,
        bottom: this._bottom,
        right: this._right,
        left: this._left
      }
    };
  }

  /**
   * @private
   */
  destroy() {
    this._destroyed = true;
    this.onProjMatrix.clear();
    this._rebuildMatricesTask.destroy();
  }
}
