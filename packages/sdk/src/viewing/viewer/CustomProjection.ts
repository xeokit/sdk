import {EventEmitter, SDKErrorType, type SDKResult} from "../../base/core";
import {
  createMat4Float32, identityMat4,
  inverseMat4, type Mat4,
  transformPoint4,
  transposeMat4,
} from "../../base/math/matrix";
import {
  createVec4Float64,
  mulVec3Scalar,
  type Vec2, type Vec3,
} from "../../base/math/vector";
import type {Camera} from "./Camera";
import type {CustomProjectionParams} from "./CustomProjectionParams";
import {CustomProjectionType} from "../../base/constants";
import {EventDispatcher} from "strongly-typed-events";
import type {Projection} from "./Projection";

// Scratch buffers reused across `unproject` calls — see
// PerspectiveProjection for the rationale.
const tempVec4a = createVec4Float64();
const tempVec4b = createVec4Float64();
const tempVec4c = createVec4Float64();

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
        worldPos: Vec3): Vec3 {

        // Mirrors PerspectiveProjection.unproject. The custom
        // projection matrix is whatever the host wires in; this
        // formula goes through its actual inverse, so any
        // well-formed projection (perspective, ortho, sheared,
        // off-axis) unprojects correctly.
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
        // See PerspectiveProjection.unproject — without resetting
        // w to 1 here, the next transformPoint4 scales the
        // inverse-view translation by the stale perspective-divide
        // w and the returned worldPos lands in camera-relative
        // space.
        tempVec4b[3] = 1;

        transformPoint4(this.camera.inverseViewMatrix, tempVec4b, tempVec4c);

        worldPos[0] = tempVec4c[0];
        worldPos[1] = tempVec4c[1];
        worldPos[2] = tempVec4c[2];

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
