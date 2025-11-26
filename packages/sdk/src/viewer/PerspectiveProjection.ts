import {EventEmitter, SDKErrorType, SDKResult} from "../core";
import {createMat4, inverseMat4, mulMat4v4, mulVec3Scalar, perspectiveMat4, transposeMat4} from "../matrix";
import type {Camera} from "./Camera";
import {EventDispatcher} from "strongly-typed-events";
import type {FloatArrayParam} from "../math";
import type {PerspectiveProjectionParams} from "./PerspectiveProjectionParams";
import {PerspectiveProjectionType} from "../constants";
import type {Projection} from "./Projection";
import {SDKTask} from "../core/SDKTask";

/**
 * PerspectiveProjection projection configuration for a {@link Camera | Camera} .
 *
 * * Located at {@link Camera.perspectiveProjection | Camera.perspectiveProjection}.
 * * Implicitly sets the left, right, top, bottom frustum planes using {@link PerspectiveProjection.fov | PerspectiveProjection.fov}.
 * * {@link PerspectiveProjection.near | PerspectiveProjection.near} and {@link PerspectiveProjection.far| PerspectiveProjection.far} specify the distances to the clipping planes.
 * * {@link PerspectiveProjection.onProjMatrix | PerspectiveProjection.onProjMatrix} will fire an event whenever {@link PerspectiveProjection.projMatrix | PerspectiveProjection.projMatrix} updates, which indicates that one or more other properties have updated.
 */
export class PerspectiveProjection implements Projection {

  /**
   * The Camera this PerspectiveProjection belongs to.
   */
  public readonly camera: Camera;

  /**
   * Emits an event each time {@link PerspectiveProjection.projMatrix | PerspectiveProjection.projMatrix} updates.
   *
   * @event
   */
  readonly onProjMatrix: EventEmitter<PerspectiveProjection, FloatArrayParam>;

  /**
   * The type of this projection.
   */
  static readonly type: number = PerspectiveProjectionType;

  private _far: number;
  private _near: number;
  private _fov: number;
  private _fovAxis: string;
  private _projMatrix: FloatArrayParam;
  private _inverseProjMatrix: FloatArrayParam;
  private _transposedProjMatrix: FloatArrayParam;
  private _inverseMatrixDirty: boolean;
  private _transposedProjMatrixDirty: boolean;
  private _onViewBoundary: any;
  private _rebuildMatricesTask: SDKTask;
  private _destroyed: boolean = false;

  /**
   * @private
   */
  constructor(camera: Camera, cfg: {
    fov?: number,
    fovAxis?: string,
    near?: number,
    far?: number
  } = {}) {

    this.camera = camera;

    this._far = cfg.far || 10000.0;
    this._near = cfg.near || 0.1;
    this._fov = cfg.fov || 60.0;
    this._fovAxis = cfg.fovAxis || "min";
    this._projMatrix = createMat4();
    this._inverseProjMatrix = createMat4();
    this._transposedProjMatrix = createMat4();
    this._inverseMatrixDirty = true;
    this._transposedProjMatrixDirty = true;

    this._onViewBoundary = this.camera.view.onBoundary.subscribe(() => this._rebuildMatricesTask.schedule());

    this.onProjMatrix = new EventEmitter(new EventDispatcher<PerspectiveProjection, FloatArrayParam>());

    this._rebuildMatricesTask = new SDKTask(() => {
      const WIDTH_INDEX = 2;
      const HEIGHT_INDEX = 3;
      const boundary = this.camera.view.boundary;
      const aspect = boundary[WIDTH_INDEX] / boundary[HEIGHT_INDEX];
      const fovAxis = this._fovAxis;
      let fov = this._fov;
      if (fovAxis === "x" || (fovAxis === "min" && aspect < 1) || (fovAxis === "max" && aspect > 1)) {
        fov = fov / aspect;
      }
      fov = Math.min(fov, 120);
      perspectiveMat4(fov * (Math.PI / 180.0), aspect, this._near, this._far, this._projMatrix);
      this._inverseMatrixDirty = true;
      this._transposedProjMatrixDirty = true;
      this.onProjMatrix.dispatch(this, this._projMatrix);
    }, SDKTask.PHASE_0);
  }

  /**
   * Gets the PerspectiveProjection's field-of-view angle (FOV).
   *
   * Default value is ````60.0````.
   *
   * @returns {Number} Current field-of-view.
   */
  get fov(): number {
    return this._fov;
  }

  /**
   * Sets the PerspectiveProjection's field-of-view angle (FOV).
   *
   * Default value is ````60.0````.
   *
   * @param value New field-of-view.
   */
  set fov(value: number) {
    if (value === this._fov) {
      return;
    }
    this._fov = value;
    this._rebuildMatricesTask.schedule();
  }

  /**
   * Gets the PerspectiveProjection's FOV axis.
   *
   * Options are ````"x"````, ````"y"```` or ````"min"````, to use the minimum axis.
   *
   * Default value is ````"min"````.
   *
   * @returns {String} The current FOV axis value.
   */
  get fovAxis(): string {
    return this._fovAxis;
  }

  /**
   * Sets the PerspectiveProjection's FOV axis.
   *
   * Options are ````"x"````, ````"y"```` or ````"min"````, to use the minimum axis.
   *
   * Default value ````"min"````.
   *
   * @param value New FOV axis value.
   */
  set fovAxis(value: string) {
    value = value || "min";
    if (this._fovAxis === value) {
      return;
    }
    if (value !== "x" && value !== "y" && value !== "min") {
      console.error("Unsupported value for 'fovAxis': " + value + " - defaulting to 'min'");
      value = "min";
    }
    this._fovAxis = value;
    this._rebuildMatricesTask.schedule();
  }

  /**
   * Gets the position of the PerspectiveProjection's near plane on the positive View-space Z-axis.
   *
   * Default value is ````0.1````.
   *
   * @returns The PerspectiveProjection's near plane position.
   */
  get near(): number {
    return this._near;
  }

  /**
   * Sets the position of the PerspectiveProjection's near plane on the positive View-space Z-axis.
   *
   * Default value is ````0.1````.
   *
   * @param value New PerspectiveProjection near plane position.
   */
  set near(value: number) {
    if (this._near === value) {
      return;
    }
    this._near = value;
    this._rebuildMatricesTask.schedule();
  }

  /**
   * Gets the position of this PerspectiveProjection's far plane on the positive View-space Z-axis.
   *
   * @return {Number} The PerspectiveProjection's far plane position.
   */
  get far(): number {
    return this._far;
  }

  /**
   * Sets the position of this PerspectiveProjection's far plane on the positive View-space Z-axis.
   *
   * @param value New PerspectiveProjection far plane position.
   */
  set far(value: number) {
    if (this._far === value) {
      return;
    }
    this._far = value;
    this._rebuildMatricesTask.schedule();
  }

  /**
   * Gets the PerspectiveProjection's projection transform matrix.
   *
   * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
   *
   * @returns  The PerspectiveProjection's projection matrix.
   */
  get projMatrix(): FloatArrayParam {
    if (this._rebuildMatricesTask.scheduled) {
      this._rebuildMatricesTask.runIfScheduled();
    }
    return this._projMatrix;
  }

  /**
   * Gets the inverse of {@link PerspectiveProjection.projMatrix | PerspectiveProjection.projMatrix}.
   *
   * @returns  The inverse of {@link PerspectiveProjection.projMatrix | PerspectiveProjection.projMatrix}.
   */
  get inverseProjMatrix(): FloatArrayParam {
    if (this._rebuildMatricesTask.scheduled) {
      this._rebuildMatricesTask.runIfScheduled();
    }
    if (this._inverseMatrixDirty) {
      inverseMat4(this._projMatrix, this._inverseProjMatrix);
      this._inverseMatrixDirty = false;
    }
    return this._inverseProjMatrix;
  }

  /**
   * Gets the transpose of {@link PerspectiveProjection.projMatrix | PerspectiveProjection.projMatrix}.
   *
   * @returns  The transpose of {@link PerspectiveProjection.projMatrix | PerspectiveProjection.projMatrix}.
   */
  get transposedProjMatrix(): FloatArrayParam {
    if (this._rebuildMatricesTask.scheduled) {
      this._rebuildMatricesTask.runIfScheduled();
    }
    if (this._transposedProjMatrixDirty) {
      transposeMat4(this._projMatrix, this._transposedProjMatrix);
      this._transposedProjMatrixDirty = false;
    }
    return this._transposedProjMatrix;
  }

  /**
   * Un-projects the given View-space coordinates and Screen-space depth, using this PerspectiveProjection projection.
   *
   * @param canvasPos Inputs 2D View-space coordinates.
   * @param screenZ Inputs Screen-space Z coordinate.
   * @param screenPos Outputs 3D Screen/Clip-space coordinates.
   * @param viewPos Outputs un-projected 3D View-space coordinates.
   * @param worldPos Outputs un-projected 3D World-space coordinates.
   */
  unproject(canvasPos: FloatArrayParam, screenZ: number, screenPos: FloatArrayParam, viewPos: FloatArrayParam, worldPos: FloatArrayParam): FloatArrayParam {

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
   * Sets the state of this PerspectiveParams from the given parameters.
   * @param perspectiveProjectionParams
   */
  fromParams(perspectiveProjectionParams: PerspectiveProjectionParams): SDKResult<any, string> {
    if (this._destroyed) {
      return this.camera.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[PerspectiveProjection.fromParams] PerspectiveProjection has been destroyed."
      });
    }
    if (perspectiveProjectionParams.far !== undefined) {
      this.far = perspectiveProjectionParams.far;
    }
    if (perspectiveProjectionParams.near !== undefined) {
      this.near = perspectiveProjectionParams.near;
    }
    if (perspectiveProjectionParams.fov !== undefined) {
      this.fov = perspectiveProjectionParams.fov;
    }
    if (perspectiveProjectionParams.fovAxis !== undefined) {
      this.fovAxis = perspectiveProjectionParams.fovAxis;
    }
    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Gets this PerspectiveProjection as JSON.
   */
  toParams(): SDKResult<PerspectiveProjectionParams, string> {
    if (this._destroyed) {
      return this.camera.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[PerspectiveProjection.toParams] PerspectiveProjection has been destroyed."
      });
    }
    return {
      ok: true,
      value: {
        far: this.far,
        near: this.near,
        fov: this.fov,
        fovAxis: this.fovAxis
      }
    };
  }

  /** @private
   */
  destroy() {
    this._rebuildMatricesTask.destroy();
    this.camera.view.onBoundary.unsubscribe(this._onViewBoundary);
    this.onProjMatrix.clear();
    this._destroyed = true;
  }
}
