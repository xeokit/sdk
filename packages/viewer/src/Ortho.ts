
import {EventDispatcher} from "strongly-typed-events";
import type {Camera} from "./Camera";
import {Component, EventEmitter} from "@xeokit/core/components";
import {FloatArrayParam} from "@xeokit/math/math";
import {OrthoProjectionType} from "@xeokit/core/constants";
import {inverseMat4, createMat4, mulMat4v4, mulVec3Scalar, orthoMat4c, transposeMat4} from "@xeokit/math/matrix";

/**
 * Orthographic projection configuration for a {@link Camera}.
 *
 * * Located at {@link Camera.ortho}.
 * * Works like Blender's orthographic projection, where the positions of the left, right, top and bottom planes are implicitly
 * indicated with a single {@link Ortho.scale} property, which causes the frustum to be symmetrical on X and Y axis, large enough to
 * contain the number of units given by {@link Ortho.scale}.
 * * {@link Ortho.near} and {@link Ortho.far} indicated the distances to the clipping planes.
 * * {@link Ortho.onProjMatrix} will fire an event whenever {@link Ortho.projMatrix} updates, which indicates that one or more other properties have updated.
 */
class Ortho extends Component {

    /**
     * The Camera this Ortho belongs to.
     */
    public readonly camera: Camera;

    /**
     * Emits an event each time {@link Ortho.projMatrix} updates.
     *
     * @event
     */
    readonly onProjMatrix: EventEmitter<Ortho, FloatArrayParam>;

    /**
     * The type of this projection.
     */
    static readonly type: number = OrthoProjectionType;

    #state: {
        far: number;
        near: number;
        scale: number;
        projMatrix: FloatArrayParam;
        inverseProjMatrix: FloatArrayParam;
        transposedProjMatrix: FloatArrayParam;
    };

    #inverseMatrixDirty: boolean;
    #transposedProjMatrixDirty: boolean;
    #onViewBoundary: any;

    /**
     * @private
     */
    constructor(camera: Camera, cfg: {
        far?: number;
        near?: number;
        scale?: number;
    } = {}) {

        super(camera, cfg);

        this.camera = camera;

        this.#state = {
            near: cfg.near || 0.1,
            far: cfg.far || 2000.0,
            scale: cfg.scale || 1.0,
            projMatrix: createMat4(),
            inverseProjMatrix: createMat4(),
            transposedProjMatrix: createMat4()
        };

        this.onProjMatrix = new EventEmitter(new EventDispatcher<Ortho, FloatArrayParam>());

        this.#inverseMatrixDirty = true;
        this.#transposedProjMatrixDirty = true;

        this.#onViewBoundary = this.camera.view.onBoundary.subscribe(() => {
            this.setDirty();
        });
    }

    /**
     * Gets scale factor for this Ortho's extents on X and Y axis.
     *
     * Clamps to minimum value of ````0.01```.
     *
     * Default value is ````1.0````
     *
     * returns New Ortho scale value.
     */
    get scale(): number {
        return this.#state.scale;
    }

    /**
     * Sets scale factor for this Ortho's extents on X and Y axis.
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
        this.#state.scale = value;
        this.setDirty();
    }

    /**
     * Gets the position of the Ortho's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * returns New Ortho near plane position.
     */
    get near(): number {
        return this.#state.near;
    }

    /**
     * Sets the position of the Ortho's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @param value New Ortho near plane position.
     */
    set near(value: number) {
        if (this.#state.near === value) {
            return;
        }
        this.#state.near = value;
        this.setDirty();
    }

    /**
     * Gets the position of the Ortho's far plane on the positive View-space Z-axis.
     *
     * Default value is ````10000.0````.
     *
     * returns New far ortho plane position.
     */
    get far(): number {
        return this.#state.far;
    }

    /**
     * Sets the position of the Ortho's far plane on the positive View-space Z-axis.
     *
     * Default value is ````2000.0````.
     *
     * @param value New far ortho plane position.
     */
    set far(value: number) {
        if (this.#state.far === value) {
            return;
        }
        this.#state.far = value;
        this.setDirty();
    }

    /**
     * Gets the Ortho's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @returns  The Ortho's projection matrix.
     */
    get projMatrix(): FloatArrayParam {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        return this.#state.projMatrix;
    }

    /**
     * Gets the inverse of {@link Ortho.projMatrix}.
     *
     * @returns  The inverse of {@link Ortho.projMatrix}.
     */
    get inverseProjMatrix(): FloatArrayParam {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        if (this.#inverseMatrixDirty) {
            inverseMat4(this.#state.projMatrix, this.#state.inverseProjMatrix);
            this.#inverseMatrixDirty = false;
        }
        return this.#state.inverseProjMatrix;
    }

    /**
     * Gets the transpose of {@link Ortho.projMatrix}.
     *
     * @returns  The transpose of {@link Ortho.projMatrix}.
     */
    get transposedProjMatrix(): FloatArrayParam {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        if (this.#transposedProjMatrixDirty) {
            transposeMat4(this.#state.projMatrix, this.#state.transposedProjMatrix);
            this.#transposedProjMatrixDirty = false;
        }
        return this.#state.transposedProjMatrix;
    }

    /**
     * @private
     */
    clean() {

        const WIDTH_INDEX = 2;
        const HEIGHT_INDEX = 3;

        const view = this.camera.view;
        const scale = this.#state.scale;
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

        orthoMat4c(left, right, bottom, top, this.#state.near, this.#state.far, this.#state.projMatrix);

        this.#inverseMatrixDirty = true;
        this.#transposedProjMatrixDirty = true;

        this.camera.view.redraw();

        this.onProjMatrix.dispatch(this, this.#state.projMatrix);
    }

    /**
     * Un-projects the given View-space coordinates, using this Ortho projection.
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

        const canvas = this.camera.view.canvasElement;

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

    /** @private
     *
     */
    destroy() {
        super.destroy();
        this.camera.view.onBoundary.unsubscribe(this.#onViewBoundary);
        this.onProjMatrix.clear();
    }
}

export {Ortho};