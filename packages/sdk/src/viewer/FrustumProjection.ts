import {EventEmitter, SDKErrorType, type SDKResult} from "../core";
import {
  createVec4Float64,
  mulVec3Scalar,
  type Vec2,
  type Vec3
} from "../math/vector";
import {
  createMat4Float64,
  type Mat4,
  frustumMat4,
  inverseMat4,
  transformPoint4,
  transposeMat4
} from "../math/matrix";
import type {Camera} from "./Camera";
import {EventDispatcher} from "strongly-typed-events";
import type {FloatArrayParam} from "../math";
import type {FrustumProjectionParams} from "./FrustumProjectionParams";
import {FrustumProjectionType} from "../constants";
import type {Projection} from "./Projection";
import {SDKTask} from "../core/SDKTask";

// Scratch buffers reused across `unproject` calls — same pattern
// as PerspectiveProjection. Module-scope is safe because the
// projection's unproject is single-threaded with respect to a
// given Camera, and callers consume the output before the next
// invocation can clobber.
const tempVec4a = createVec4Float64();
const tempVec4b = createVec4Float64();
const tempVec4c = createVec4Float64();

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
  private _buildMatricesTask: SDKTask;

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
  private _projMatrix: Mat4;
  private _inverseProjMatrix: Mat4;
  private _transposedProjMatrix: Mat4;
  private _inverseMatrixDirty: boolean;
  private _transposedProjMatrixDirty: boolean;
  private _destroyed: boolean = false;

  /**
   * @private
   */
  constructor(camera: Camera, cfg: FrustumProjectionParams = {}) {

    this.camera = camera;

    this._projMatrix = createMat4Float64();
    this._inverseProjMatrix = createMat4Float64();
    this._transposedProjMatrix = createMat4Float64();
    this._near = 0.1;
    this._far = 10000.0;
    this._left = (cfg.left !== undefined && cfg.left !== null) ? cfg.left : -1.0;
    this._right = (cfg.right !== undefined && cfg.right !== null) ? cfg.right : 1.0;
    this._bottom = (cfg.bottom !== undefined && cfg.bottom !== null) ? cfg.bottom : -1.0;
    this._top = (cfg.top !== undefined && cfg.top !== null) ? cfg.top : 1.0;

    this.onProjMatrix = new EventEmitter(new EventDispatcher<FrustumProjection, Mat4>());

    this._inverseMatrixDirty = true;
    this._transposedProjMatrixDirty = true;

    this._buildMatricesTask = new SDKTask({
      name: "FrustumProjection._buildMatricesTask",
      task: () => {
        frustumMat4(this._left, this._right, this._bottom, this._top, this._near, this._far, this.projMatrix);
        this._inverseMatrixDirty = true;
        this._transposedProjMatrixDirty = true;
        this.onProjMatrix.dispatch(this, this.projMatrix);
      },
      stage: SDKTask.ComputeStage
    });

    this._buildMatricesTask.schedule();
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
    this._buildMatricesTask.schedule();
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
    this._buildMatricesTask.schedule();
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
    this._buildMatricesTask.schedule();
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
    this._buildMatricesTask.schedule();
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
    this._buildMatricesTask.schedule();
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
    this._buildMatricesTask.schedule();
  }

  /**
   * Gets the FrustumProjection's projection transform matrix.
   *
   * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
   *
   * @returns The FrustumProjection's projection matrix
   */
  get projMatrix(): Mat4 {
    if (this._buildMatricesTask.scheduled) {
      this._buildMatricesTask.runIfScheduled();
    }
    return this._projMatrix;
  }

  /**
   * Gets the inverse of {@link FrustumProjection.projMatrix}.
   *
   * @returns  The inverse orthographic projection projMatrix.
   */
  get inverseProjMatrix(): Mat4 {
    if (this._buildMatricesTask.scheduled) {
      this._buildMatricesTask.runIfScheduled();
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
  get transposedProjMatrix(): Mat4 {
    if (this._buildMatricesTask.scheduled) {
      this._buildMatricesTask.runIfScheduled();
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
    canvasPos: Vec2,
    screenZ: number,
    screenPos: Vec3,
    viewPos: Vec3,
    worldPos: Vec3): Vec3{

    // Mirrors PerspectiveProjection.unproject — the formula is
    // fully general (it goes through inverseProjMatrix, which
    // already encodes any frustum asymmetry), so the same
    // implementation applies regardless of left/right balance.
    const htmlElement = this.camera.view.htmlElement;
    const halfViewWidth  = htmlElement.offsetWidth  / 2.0;
    const halfViewHeight = htmlElement.offsetHeight / 2.0;

    screenPos[0] = (canvasPos[0] - halfViewWidth)  / halfViewWidth;
    screenPos[1] = (canvasPos[1] - halfViewHeight) / halfViewHeight;
    screenPos[2] = screenZ;

    tempVec4a[0] = screenPos[0];
    tempVec4a[1] = screenPos[1];
    tempVec4a[2] = screenPos[2];
    tempVec4a[3] = 1.0;

    transformPoint4(this.inverseProjMatrix, tempVec4a, tempVec4b);
    mulVec3Scalar(tempVec4b as Vec3, 1.0 / tempVec4b[3]);

    viewPos[0] = tempVec4b[0];
    viewPos[1] = tempVec4b[1];
    viewPos[2] = tempVec4b[2];

    tempVec4b[1] *= -1;

    transformPoint4(this.camera.inverseViewMatrix, tempVec4b, tempVec4c);

    worldPos[0] = tempVec4c[0];
    worldPos[1] = tempVec4c[1];
    worldPos[2] = tempVec4c[2];

    return worldPos;
  }

  /**
   * Configures this FrustumProjection.
   *
   * @param frustumProjectionParams
   */
  fromParams(frustumProjectionParams: FrustumProjectionParams): SDKResult<any> {
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
    this._buildMatricesTask.schedule();
    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Gets the current configuration of this FrustumProjection.
   */
  toParams(): SDKResult<FrustumProjectionParams> {
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
    this._buildMatricesTask.destroy();
  }
}
