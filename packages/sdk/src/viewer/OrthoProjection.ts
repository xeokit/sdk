import {EventEmitter} from "../core";
import {createMat4, inverseMat4, mulMat4v4, mulVec3Scalar, orthoMat4c, transposeMat4} from "../matrix";
import type {Camera} from "./Camera";
import {EventDispatcher} from "strongly-typed-events";
import type {FloatArrayParam} from "../math";
import type {OrthoProjectionParams} from "./OrthoProjectionParams";
import {OrthoProjectionType} from "../constants";
import type {Projection} from "./Projection";
import {Task} from "../core/Task";


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
     * @private
     */
    private _task: Task;

    /**
     * The Camera this OrthoProjection belongs to.
     */
    public readonly camera: Camera;

    /**
     * Emits an event each time {@link OrthoProjection.projMatrix | OrthoProjection.projMatrix} updates.
     *
     * @event
     */
    readonly onProjMatrix: EventEmitter<OrthoProjection, FloatArrayParam>;

    /**
     * The type of this projection.
     */
    static readonly type: number = OrthoProjectionType;

    private _far: number;
    private _near: number;
    private _scale: number;
    private _projMatrix: FloatArrayParam;
    private _inverseProjMatrix: FloatArrayParam;
    private _transposedProjMatrix: FloatArrayParam;
    private _inverseMatrixDirty: boolean;
    private _transposedProjMatrixDirty: boolean;
    private _onViewBoundary: any;

    /**
     * @private
     */
    constructor(camera: Camera, cfg: OrthoProjectionParams = {}) {

        this.camera = camera;
        this._near = cfg.near || 0.1;
        this._far = cfg.far || 2000.0;
        this._scale = cfg.scale || 1.0;
        this._projMatrix = createMat4();
        this._inverseProjMatrix = createMat4();
        this._transposedProjMatrix = createMat4();

        this.onProjMatrix = new EventEmitter(new EventDispatcher<OrthoProjection, FloatArrayParam>());

        this._inverseMatrixDirty = true;
        this._transposedProjMatrixDirty = true;

        this._onViewBoundary = this.camera.view.onBoundary.subscribe(() => {
            this._task.setDirty();
        });

        this._task = new Task(() => {
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
        this._task.setDirty();
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
        this._task.setDirty();
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
        this._task.setDirty();
    }

    /**
     * Gets the OrthoProjection's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @returns  The OrthoProjection's projection matrix.
     */
    get projMatrix(): FloatArrayParam {
        if (this._task.dirty) {
            this._task.cleanIfDirty();
        }
        return this._projMatrix;
    }

    /**
     * Gets the inverse of {@link OrthoProjection.projMatrix | OrthoProjection.projMatrix}.
     *
     * @returns  The inverse of {@link OrthoProjection.projMatrix | OrthoProjection.projMatrix}.
     */
    get inverseProjMatrix(): FloatArrayParam {
        if (this._task.dirty) {
            this._task.cleanIfDirty();
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
    get transposedProjMatrix(): FloatArrayParam {
        if (this._task.dirty) {
            this._task.cleanIfDirty();
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
        canvasPos: FloatArrayParam,
        screenZ: number,
        screenPos: FloatArrayParam,
        viewPos: FloatArrayParam,
        worldPos: FloatArrayParam): FloatArrayParam {

        const canvas = this.camera.view.htmlElement;

        const halfViewWidth = canvas.offsetWidth / 2.0;
        const halfViewHeight = canvas.offsetHeight / 2.0;

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
     * Configures this OrthoProjection.
     *
     * @param orthoProjectionParams
     */
    fromParams(orthoProjectionParams: OrthoProjectionParams) {
        if (orthoProjectionParams.far !== undefined) {
            this.far = orthoProjectionParams.far;
        }
        if (orthoProjectionParams.near !== undefined) {
            this.near = orthoProjectionParams.near;
        }
        if (orthoProjectionParams.scale !== undefined) {
            this.scale = orthoProjectionParams.scale;
        }
    }

    /**
     * Gets the current configuration of this OrthoProjection.
     */
    toParams(): OrthoProjectionParams {
        return {
            far: this.far,
            near: this.near,
            scale: this.scale
        };
    }

    /** @private
     *
     */
    destroy() {
        this._task.destroy();
        this.camera.view.onBoundary.unsubscribe(this._onViewBoundary);
        this.onProjMatrix.clear();
    }
}

