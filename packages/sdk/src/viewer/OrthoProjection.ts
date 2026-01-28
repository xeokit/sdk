import {EventEmitter, SDKErrorType, type SDKResult} from "../core";
import {
  createMat4Float64,
  inverseMat4,
  orthoMat4c,
  transposeMat4
} from "../math/matrix";
import {
  type Vec2,
  type Vec3
} from "../math/vector";
import type {Camera} from "./Camera";
import {EventDispatcher} from "strongly-typed-events";
import type {Mat4} from "../math/matrix";
import type {OrthoProjectionParams} from "./OrthoProjectionParams";
import {OrthoProjectionType} from "../constants";
import type {Projection} from "./Projection";
import {SDKTask} from "../core/SDKTask";


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
    this._scale = cfg.scale || 1.0;
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

    // const canvas = this.camera.view.htmlElement;
    //
    // const halfViewWidth = canvas.offsetWidth / 2.0;
    // const halfViewHeight = canvas.offsetHeight / 2.0;
    //
    // screenPos[0] = (canvasPos[0] - halfViewWidth) / halfViewWidth;
    // screenPos[1] = (canvasPos[1] - halfViewHeight) / halfViewHeight;
    // screenPos[2] = screenZ;
    // screenPos[3] = 1.0;
    //
    // mulMat4v4(this.inverseProjMatrix, screenPos, viewPos);
    // mulVec3Scalar(viewPos, 1.0 / viewPos[3]);
    //
    // viewPos[3] = 1.0;
    // viewPos[1] *= -1;
    //
    // mulMat4v4(this.camera.inverseViewMatrix, viewPos, worldPos);

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

