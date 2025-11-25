import {EventEmitter, SDKErrorType, SDKResult} from "../core";
import {createMat4, identityMat4, inverseMat4, mulMat4v4, mulVec3Scalar, transposeMat4} from "../matrix";
import type {Camera} from "./Camera";
import type {CustomProjectionParams} from "./CustomProjectionParams";
import {CustomProjectionType} from "../constants";
import {EventDispatcher} from "strongly-typed-events";
import type {FloatArrayParam} from "../math";
import type {Projection} from "./Projection";
import {FrustumProjectionParams} from "./FrustumProjectionParams";

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
    readonly onProjMatrix: EventEmitter<CustomProjection, FloatArrayParam>;

    /**
     * The type of this projection.
     */
    static readonly type: number = CustomProjectionType;

    private _projMatrix: FloatArrayParam;
    private _transposedProjMatrix: FloatArrayParam;
    private _inverseProjMatrix: FloatArrayParam
    private _inverseProjMatrixDirty: boolean;
    private _transposedProjMatrixDirty: boolean;

    private _destroyed: boolean = false;

    /**
     * @private
     */
    constructor(camera: Camera, cfg: CustomProjectionParams = {}) {

        this.camera = camera;

        this._projMatrix = createMat4(cfg.projMatrix || identityMat4());
        this._inverseProjMatrix = createMat4();
        this._transposedProjMatrix = createMat4();

        this.onProjMatrix = new EventEmitter(new EventDispatcher<CustomProjection, FloatArrayParam>());

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
    get projMatrix(): FloatArrayParam {
        return this._projMatrix;
    }

    /**
     * Sets the CustomProjection's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @param projMatrix New value for the CustomProjection's matrix.
     */
    set projMatrix(projMatrix: FloatArrayParam) {
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
    get inverseProjMatrix(): FloatArrayParam {
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
    get transposedProjMatrix(): FloatArrayParam {
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
        canvasPos: FloatArrayParam,
        screenZ: number,
        screenPos: FloatArrayParam,
        viewPos: FloatArrayParam,
        worldPos: FloatArrayParam) {
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
     * Configures this CustomProjection.
     * @param customProjectionParams
     */
    fromParams(customProjectionParams: CustomProjectionParams): SDKResult<any, string> {
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
    toParams(): SDKResult<CustomProjectionParams, string> {
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
        projMatrix: Array.from(this.projMatrix)
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
