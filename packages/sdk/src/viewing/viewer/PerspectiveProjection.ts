import {EventEmitter, SDKErrorType, type SDKResult} from "../../base/core";
import {
  createMat4Float64,
  inverseMat4, mulMat4v4,
  perspectiveMat4, transformPoint4,
  transposeMat4
} from "../../base/math/matrix";
import {
  createVec4Float64,
  mulVec3Scalar,
  type Vec2,
  type Vec3,
} from "../../base/math/vector";
import type {Camera} from "./Camera";
import {EventDispatcher} from "strongly-typed-events";
import type {Mat4} from "../../base/math/matrix";
import type {PerspectiveProjectionParams} from "./PerspectiveProjectionParams";
import {PerspectiveProjectionType} from "../../base/constants";
import type {Projection} from "./Projection";
import {SDKTask} from "../../base/core/SDKTask";
import {getElementCssSize} from "./getElementCssSize";

const tempVec4a = createVec4Float64();
const tempVec4b = createVec4Float64();
const tempVec4c = createVec4Float64();


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
   */
  readonly onProjMatrix: EventEmitter<PerspectiveProjection, Mat4>;

  /**
   * The type of this projection.
   */
  static readonly type: number = PerspectiveProjectionType;

  private _far: number;
  private _near: number;
  private _fov: number;
  private _fovAxis: string;
  private _projMatrix: Mat4;
  private _inverseProjMatrix: Mat4;
  private _transposedProjMatrix: Mat4;
  private _inverseMatrixDirty: boolean;
  private _transposedProjMatrixDirty: boolean;
  private _onViewBoundary: any;
  private _buildMatricesTask: SDKTask;
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
    this._projMatrix = createMat4Float64();
    this._inverseProjMatrix = createMat4Float64();
    this._transposedProjMatrix = createMat4Float64();
    this._inverseMatrixDirty = true;
    this._transposedProjMatrixDirty = true;

    this._onViewBoundary = this.camera.view.viewer.events.onViewCanvasBoundaryChanged
      .subscribe((view, _) => {
        if (view === this.camera.view) {
          this._buildMatricesTask.schedule();
        }
      });

    this.onProjMatrix = new EventEmitter(new EventDispatcher<PerspectiveProjection, Mat4>());

    this._buildMatricesTask = new SDKTask({
      name: "PerspectiveProjection._buildMatricesTask",
      task: () => {
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
      },
      stage: SDKTask.ComputeStage
    });

    this._buildMatricesTask.schedule();
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
    this._buildMatricesTask.schedule();
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
    this._buildMatricesTask.schedule();
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
    this._buildMatricesTask.schedule();
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
    this._buildMatricesTask.schedule();
  }

  /**
   * Gets the PerspectiveProjection's projection transform matrix.
   *
   * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
   *
   * @returns  The PerspectiveProjection's projection matrix.
   */
  get projMatrix(): Mat4 {
    if (this._buildMatricesTask.scheduled) {
      this._buildMatricesTask.runIfScheduled();
    }
    return this._projMatrix;
  }

  /**
   * Gets the inverse of {@link PerspectiveProjection.projMatrix | PerspectiveProjection.projMatrix}.
   *
   * @returns  The inverse of {@link PerspectiveProjection.projMatrix | PerspectiveProjection.projMatrix}.
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
   * Gets the transpose of {@link PerspectiveProjection.projMatrix | PerspectiveProjection.projMatrix}.
   *
   * @returns  The transpose of {@link PerspectiveProjection.projMatrix | PerspectiveProjection.projMatrix}.
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
   * Un-projects the given View-space coordinates and Screen-space depth, using this PerspectiveProjection projection.
   *
   * @param canvasPos Inputs 2D View-space coordinates.
   * @param screenZ Inputs Screen-space Z coordinate.
   * @param screenPos Outputs 3D Screen/Clip-space coordinates.
   * @param viewPos Outputs un-projected 3D View-space coordinates.
   * @param worldPos Outputs un-projected 3D World-space coordinates.
   */
  unproject(canvasPos: Vec2, screenZ: number, screenPos: Vec3, viewPos: Vec3, worldPos: Vec3): Vec3 {

    const htmlElement = this.camera.view.htmlElement;
    const cssSize = getElementCssSize(htmlElement);
    const halfViewWidth = cssSize.width / 2.0;
    const halfViewHeight = cssSize.height / 2.0;

    screenPos[0] = (canvasPos[0] - halfViewWidth) / halfViewWidth;
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
    // After the perspective divide above, .xyz holds the
    // view-space position but .w is still the pre-divide value
    // (~ 1/-screenZ for a far-plane sample, i.e. tiny). Leaving
    // it there makes the next `transformPoint4` scale the
    // inverse-view translation column by that tiny w — so the
    // camera-eye offset effectively drops out and the returned
    // worldPos lands in camera-relative space rather than
    // absolute world. Pinning w to 1 here keeps the translation
    // intact. Visible as surface picking returning null for any
    // model whose origin sits far from world zero (UTM-scale
    // scenes, georeferenced BIM): the ray construction used
    // worldPos - eye for the direction, and with worldPos
    // relative to the eye the resulting ray was garbage.
    tempVec4b[3] = 1;

    transformPoint4(this.camera.inverseViewMatrix, tempVec4b, tempVec4c);

    worldPos[0] = tempVec4c[0];
    worldPos[1] = tempVec4c[1];
    worldPos[2] = tempVec4c[2];

    return worldPos;
  }

  /**
   * Sets the state of this PerspectiveParams from the given parameters.
   * @param perspectiveProjectionParams
   */
  fromParams(perspectiveProjectionParams: PerspectiveProjectionParams): SDKResult<any> {
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
  toParams(): SDKResult<PerspectiveProjectionParams> {
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
    this._buildMatricesTask.destroy();
    this.camera.view.viewer.events.onViewCanvasBoundaryChanged.unsubscribe(this._onViewBoundary);
    this.onProjMatrix.clear();
    this._destroyed = true;
  }
}
