import {EventEmitter, SDKErrorType, type SDKResult} from "../../base/core";
import {
  createMat4Float64,
  inverseMat4,
  orthoMat4c,
  transformPoint4,
  transposeMat4
} from "../../base/math/matrix";
import {
  createVec4Float64,
  mulVec3Scalar,
  type Vec2,
  type Vec3
} from "../../base/math/vector";
import type {Camera} from "./Camera";
import {EventDispatcher} from "strongly-typed-events";
import type {Mat4} from "../../base/math/matrix";
import type {OrthoProjectionParams} from "./OrthoProjectionParams";
import {OrthoProjectionType} from "../../base/constants";
import type {Projection} from "./Projection";
import {SDKTask} from "../../base/core/SDKTask";
import {getElementCssSize} from "./getElementCssSize";

// Scratch buffers reused across `unproject` calls — see
// PerspectiveProjection for the rationale.
const tempVec4a = createVec4Float64();
const tempVec4b = createVec4Float64();
const tempVec4c = createVec4Float64();


/**
 * Orthographic projection configuration for a {@link Camera | Camera} .
 *
 * * Located at {@link Camera.orthoProjection | Camera.orthoProjection}.
 * * Works like Blender's orthographic projection, where the positions of the left, right, top and bottom planes are implicitly
 * indicated with a single {@link OrthoProjection.scale | OrthoProjection.scale} property, which causes the frustum to be symmetrical on X and Y axis, large enough to
 * contain the number of units given by {@link OrthoProjection.scale | OrthoProjection.scale}.
 * * {@link OrthoProjection.near | OrthoProjection.near} and {@link OrthoProjection.far | OrthoProjection.far} indicated the distances to the clipping planes.
 * * {@link OrthoProjection.onProjMatrix | OrthoProjection.onProjMatrix} will fire an event whenever {@link OrthoProjection.projMatrix | OrthoProjection.projMatrix} updates, which indicates that one or more other properties have updated.
 */
export class OrthoProjection implements Projection {

  /**
   * The task that updates the projection matrix.
   */
  private _buildMatricesTask: SDKTask;

  /**
   * The Camera this OrthoProjection belongs to.
   */
  public readonly camera: Camera;

  /**
   * Emits an event each time {@link OrthoProjection.projMatrix | OrthoProjection.projMatrix} updates.
   */
  readonly onProjMatrix: EventEmitter<OrthoProjection, Mat4>;

  /**
   * The type of this projection.
   */
  static readonly type: number = OrthoProjectionType;

  private _far: number;
  private _near: number;
  private _scale: number;
  private _projMatrix: Mat4;
  private _inverseProjMatrix: Mat4;
  private _transposedProjMatrix: Mat4;
  private _inverseMatrixDirty: boolean;
  private _transposedProjMatrixDirty: boolean;
  private _onViewBoundary: any;
  private _destroyed: boolean = false;

  /**
   * @private
   */
  constructor(camera: Camera, cfg: OrthoProjectionParams = {}) {

    this.camera = camera;
    this._near = cfg.near || 0.1;
    this._far = cfg.far || 2000.0;
    this._scale = cfg.scale || 20.0;
    this._projMatrix = createMat4Float64();
    this._inverseProjMatrix = createMat4Float64();
    this._transposedProjMatrix = createMat4Float64();

    this.onProjMatrix = new EventEmitter(new EventDispatcher<OrthoProjection, Mat4>());

    this._inverseMatrixDirty = true;
    this._transposedProjMatrixDirty = true;

    this._onViewBoundary = this.camera.view.viewer.events.onViewCanvasBoundaryChanged
      .subscribe((view, _) => {
        if (view === this.camera.view) {
          this._buildMatricesTask.schedule();
        }
      });

    this._buildMatricesTask = new SDKTask({
      name: "OrthoProjection._buildMatricesTask",
      task: () => {
        const WIDTH_INDEX = 2;
        const HEIGHT_INDEX = 3;

        const view = this.camera.view;
        const scale = this._scale;
        const halfSize = 0.5 * scale;

        const boundary = view.boundary;
        const boundaryWidth = boundary[WIDTH_INDEX];
        const boundaryHeight = boundary[HEIGHT_INDEX];
        const aspect = boundaryWidth / boundaryHeight;

        let left;
        let right;
        let top;
        let bottom;

        if (boundaryWidth > boundaryHeight) {
          left = -halfSize;
          right = halfSize;
          top = halfSize / aspect;
          bottom = -halfSize / aspect;

        } else {
          left = -halfSize * aspect;
          right = halfSize * aspect;
          top = halfSize;
          bottom = -halfSize;
        }

        orthoMat4c(left, right, bottom, top, this._near, this._far, this._projMatrix);

        this._inverseMatrixDirty = true;
        this._transposedProjMatrixDirty = true;

        this.onProjMatrix.dispatch(this, this._projMatrix);
      },
      stage: SDKTask.ComputeStage
    });

    this._buildMatricesTask.schedule();
  }

  /**
   * Gets scale factor for this OrthoProjection's extents on X and Y axis.
   *
   * Clamps to minimum value of ````0.01```.
   *
   * Default value is ````1.0````
   *
   * returns New OrthoProjection scale value.
   */
  get scale(): number {
    return this._scale;
  }

  /**
   * Sets scale factor for this OrthoProjection's extents on X and Y axis.
   *
   * Clamps to minimum value of ````0.01```.
   *
   * Default value is ````1.0````
   * @param value New scale value.
   */
  set scale(value: number) {
    if (value <= 0) {
      value = 0.01;
    }
    this._scale = value;
    this._buildMatricesTask.schedule();
  }

  /**
   * Gets the position of the OrthoProjection's near plane on the positive View-space Z-axis.
   *
   * Default value is ````0.1````.
   *
   * returns New OrthoProjection near plane position.
   */
  get near(): number {
    return this._near;
  }

  /**
   * Sets the position of the OrthoProjection's near plane on the positive View-space Z-axis.
   *
   * Default value is ````0.1````.
   *
   * @param value New OrthoProjection near plane position.
   */
  set near(value: number) {
    if (this._near === value) {
      return;
    }
    this._near = value;
    this._buildMatricesTask.schedule();
  }

  /**
   * Gets the position of the OrthoProjection's far plane on the positive View-space Z-axis.
   *
   * Default value is ````10000.0````.
   *
   * returns New far ortho plane position.
   */
  get far(): number {
    return this._far;
  }

  /**
   * Sets the position of the OrthoProjection's far plane on the positive View-space Z-axis.
   *
   * Default value is ````2000.0````.
   *
   * @param value New far ortho plane position.
   */
  set far(value: number) {
    if (this._far === value) {
      return;
    }
    this._far = value;
    this._buildMatricesTask.schedule();
  }

  /**
   * Gets the OrthoProjection's projection transform matrix.
   *
   * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
   *
   * @returns  The OrthoProjection's projection matrix.
   */
  get projMatrix(): Mat4 {
    if (this._buildMatricesTask.scheduled) {
      this._buildMatricesTask.runIfScheduled();
    }
    return this._projMatrix;
  }

  /**
   * Gets the inverse of {@link OrthoProjection.projMatrix | OrthoProjection.projMatrix}.
   *
   * @returns  The inverse of {@link OrthoProjection.projMatrix | OrthoProjection.projMatrix}.
   */
  get inverseProjMatrix(): Mat4 {
    if (this._buildMatricesTask.scheduled) {
      this._buildMatricesTask.runIfScheduled();
    }
    if (this._inverseMatrixDirty) {
      inverseMat4(this._projMatrix, this._inverseProjMatrix);
      this._inverseMatrixDirty = false;
    }
    return this._inverseProjMatrix;
  }

  /**
   * Gets the transpose of {@link OrthoProjection.projMatrix | OrthoProjection.projMatrix}.
   *
   * @returns  The transpose of {@link OrthoProjection.projMatrix | OrthoProjection.projMatrix}.
   */
  get transposedProjMatrix(): Mat4 {
    if (this._buildMatricesTask.scheduled) {
      this._buildMatricesTask.runIfScheduled();
    }
    if (this._transposedProjMatrixDirty) {
      transposeMat4(this._projMatrix, this._transposedProjMatrix);
      this._transposedProjMatrixDirty = false;
    }
    return this._transposedProjMatrix;
  }

  /**
   * Un-projects the given View-space coordinates, using this OrthoProjection projection.
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
    worldPos: Vec3): Vec3 {

    // Same generalised inverse-projection formula as
    // PerspectiveProjection — works for ortho without
    // modification because we go through the projection matrix's
    // actual inverse rather than a closed-form perspective
    // shortcut. For an orthographic projection the perspective
    // divide collapses to the identity (w stays 1), but we still
    // run it so the same code path covers any future weirdness in
    // the projection matrix.
    const htmlElement = this.camera.view.htmlElement;
    const cssSize = getElementCssSize(htmlElement);
    const halfViewWidth = cssSize.width / 2.0;
    const halfViewHeight = cssSize.height / 2.0;

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
    // See PerspectiveProjection.unproject for why this is needed —
    // `mulVec3Scalar` divides .xyz by w but leaves .w stale, and
    // the subsequent transformPoint4 would otherwise scale the
    // inverse-view translation by that stale w. Pinning w=1 keeps
    // the eye offset in the returned world position.
    tempVec4b[3] = 1;

    transformPoint4(this.camera.inverseViewMatrix, tempVec4b, tempVec4c);

    worldPos[0] = tempVec4c[0];
    worldPos[1] = tempVec4c[1];
    worldPos[2] = tempVec4c[2];

    return worldPos;
  }

  /**
   * Configures this OrthoProjection.
   *
   * @param orthoProjectionParams
   */
  fromParams(orthoProjectionParams: OrthoProjectionParams): SDKResult<any> {
    if (this._destroyed) {
      return this.camera.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[OrthoProjection.fromParams] OrthoProjection has been destroyed."
      });
    }
    if (orthoProjectionParams.far !== undefined) {
      this.far = orthoProjectionParams.far;
    }
    if (orthoProjectionParams.near !== undefined) {
      this.near = orthoProjectionParams.near;
    }
    if (orthoProjectionParams.scale !== undefined) {
      this.scale = orthoProjectionParams.scale;
    }
    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Gets the current configuration of this OrthoProjection.
   */
  toParams(): SDKResult<OrthoProjectionParams> {
    if (this._destroyed) {
      return this.camera.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[OrthoProjection.toParams] OrthoProjection has been destroyed."
      });
    }
    return {
      ok: true,
      value: {
        far: this.far,
        near: this.near,
        scale: this.scale
      }
    };
  }

  /**
   * @private
   */
  destroy() {
    this._buildMatricesTask.destroy();
    this.camera.view.viewer.events.onViewCanvasBoundaryChanged.unsubscribe(this._onViewBoundary);
    this.onProjMatrix.clear();
    this._destroyed = true;
  }
}
