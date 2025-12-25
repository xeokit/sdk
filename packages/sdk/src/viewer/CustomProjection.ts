import {EventEmitter, SDKErrorType, type SDKResult} from "../core";
import {
  createMat4Float32, identityMat4,
  inverseMat4, type Mat4,
  transposeMat4, type Vec2, type Vec3,
} from "../math";
import type {Camera} from "./Camera";
import type {CustomProjectionParams} from "./CustomProjectionParams";
import {CustomProjectionType} from "../constants";
import {EventDispatcher} from "strongly-typed-events";
import type {Projection} from "./Projection";

/**
 * Configures a custom projection for a {@link Camera | Camera} .
 *
 * * Located at {@link Camera.customProjection}.
 * * {@link CustomProjection.onProjMatrix} will fire an event whenever {@link CustomProjection.projMatrix} updates, which indicates that one or more other properties have updated.
 */
class CustomProjection implements Projection {

    /**
     * The Camera this CustomProjection belongs to.
     */
    public readonly camera: Camera;

    /**
     * Emits an event each time {@link CustomProjection.projMatrix} updates.
     *
     * @private
     */
    readonly onProjMatrix: EventEmitter<CustomProjection, Mat4>;

    /**
     * The type of this projection.
     */
    static readonly type: number = CustomProjectionType;

    private _projMatrix: Mat4;
    private _transposedProjMatrix: Mat4;
    private _inverseProjMatrix: Mat4
    private _inverseProjMatrixDirty: boolean;
    private _transposedProjMatrixDirty: boolean;

    private _destroyed: boolean = false;

    /**
     * @private
     */
    constructor(camera: Camera, cfg: CustomProjectionParams = {}) {

        this.camera = camera;

        this._projMatrix = cfg.projMatrix? createMat4Float32(cfg.projMatrix): identityMat4(createMat4Float32());
        this._inverseProjMatrix = createMat4Float32();
        this._transposedProjMatrix = createMat4Float32();

        this.onProjMatrix = new EventEmitter(new EventDispatcher<CustomProjection, Mat4>());

        this._inverseProjMatrixDirty = true;
        this._transposedProjMatrixDirty = false;
    }

    /**
     * Gets the CustomProjection's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @return  New value for the CustomProjection's matrix.
     */
    get projMatrix(): Mat4 {
        return this._projMatrix;
    }

    /**
     * Sets the CustomProjection's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @param projMatrix New value for the CustomProjection's matrix.
     */
    set projMatrix(projMatrix: Mat4) {
        // @ts-ignore
        this._projMatrix.set(projMatrix);
        this._inverseProjMatrixDirty = true;
        this._transposedProjMatrixDirty = true;
        this.onProjMatrix.dispatch(this, this._projMatrix);
    }

    /**
     * Gets the inverse of {@link CustomProjection.projMatrix}.
     *
     * @returns The inverse of {@link CustomProjection.projMatrix}.
     */
    get inverseProjMatrix(): Mat4 {
        if (this._inverseProjMatrixDirty) {
            inverseMat4(this._projMatrix, this._inverseProjMatrix);
            this._inverseProjMatrixDirty = false;
        }
        return this._inverseProjMatrix;
    }

    /**
     * Gets the transpose of {@link CustomProjection.projMatrix}.
     *
     * @returns The transpose of {@link CustomProjection.projMatrix}.
     */
    get transposedProjMatrix(): Mat4 {
        if (this._transposedProjMatrixDirty) {
            transposeMat4(this._projMatrix, this._transposedProjMatrix);
            this._transposedProjMatrixDirty = false;
        }
        return this._transposedProjMatrix;
    }

    /**
     * Un-projects the given View-space coordinates, using this CustomProjection.
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
        worldPos: Vec3) {
        // const htmlElement = this.camera.view.htmlElement;
        // const halfViewWidth = htmlElement.offsetWidth / 2.0;
        // const halfViewHeight = htmlElement.offsetHeight / 2.0;
        // screenPos[0] = (canvasPos[0] - halfViewWidth) / halfViewWidth;
        // screenPos[1] = (canvasPos[1] - halfViewHeight) / halfViewHeight;
        // screenPos[2] = screenZ;
        // screenPos[3] = 1.0;
        // mulMat4v4(this.inverseProjMatrix, screenPos, viewPos);
        // mulVec3Scalar(viewPos, 1.0 / viewPos[3]);
        // viewPos[3] = 1.0;
        // viewPos[1] *= -1;
        // mulMat4v4(this.camera.inverseViewMatrix, viewPos, worldPos);
        return worldPos;
    }

    /**
     * Configures this CustomProjection.
     * @param customProjectionParams
     */
    fromParams(customProjectionParams: CustomProjectionParams): SDKResult<any> {
        if (this._destroyed) {
            return this.camera.view.viewer.logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[CustomProjection.fromParams] CustomProjection has been destroyed."
            });
        }
        if (customProjectionParams.projMatrix) {
            this.projMatrix = customProjectionParams.projMatrix;
        }
        return {
            ok: true,
            value: undefined
        };
    }

    /**
     * Gets the current configuration of this CustomProjection.
     */
    toParams(): SDKResult<CustomProjectionParams> {
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
        projMatrix: <Mat4>Array.from(this.projMatrix)
        }
      };
    }

    /** @private
     *
     */
    destroy() {
        this.onProjMatrix.clear();
        this._destroyed = true;
    }
}

export {CustomProjection};
