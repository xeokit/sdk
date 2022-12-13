import {Component} from '../../Component';
import type {Camera} from "./Camera";
import * as math from '../../math/index';

/**
 * Orthographic projection configuration for a {@link Camera}.
 *
 * * Located at {@link Camera.ortho}.
 * * Works like Blender's orthographic projection, where the positions of the left, right, top and bottom planes are implicitly
 * indicated with a single {@link Ortho.scale} property, which causes the frustum to be symmetrical on X and Y axis, large enough to
 * contain the number of units given by {@link Ortho.scale}.
 * * {@link Ortho.near} and {@link Ortho.far} indicated the distances to the clipping planes.
 */
class Ortho extends Component {

    /**
     * The Camera this Ortho belongs to.
     */
    public readonly camera: Camera;

    #state: {
        transposedMatrix: math.FloatArrayParam;
        far: number;
        near: number;
        scale: number;
        matrix: math.FloatArrayParam;
        inverseMatrix: math.FloatArrayParam
    };

    #inverseMatrixDirty: boolean;
    #transposedMatrixDirty: boolean;
    #onCanvasBoundary: any;

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
            matrix: math.mat4(),
            inverseMatrix: math.mat4(),
            transposedMatrix: math.mat4(),
            near: cfg.near || 0.1,
            far: cfg.far || 2000.0,
            scale: cfg.scale || 1.0
        };

        this.#inverseMatrixDirty = true;
        this.#transposedMatrixDirty = true;

        this.#onCanvasBoundary = this.camera.view.canvas.events.on("boundary", () => {
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
     * Fires a "near" emits on change.
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
     * Fires a "far" event on change.
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
     * Fires a "matrix" event on change.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @returns  The Ortho's projection matrix.
     */
    get matrix(): math.FloatArrayParam {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        return this.#state.matrix;
    }

    /**
     * Gets the inverse of {@link Ortho.matrix}.
     *
     * @returns  The inverse of {@link Ortho.matrix}.
     */
    get inverseMatrix(): math.FloatArrayParam {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        if (this.#inverseMatrixDirty) {
            math.inverseMat4(this.#state.matrix, this.#state.inverseMatrix);
            this.#inverseMatrixDirty = false;
        }
        return this.#state.inverseMatrix;
    }

    /**
     * Gets the transpose of {@link Ortho.matrix}.
     *
     * @returns  The transpose of {@link Ortho#matrix}.
     */
    get transposedMatrix(): math.FloatArrayParam {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        if (this.#transposedMatrixDirty) {
            math.transposeMat4(this.#state.matrix, this.#state.transposedMatrix);
            this.#transposedMatrixDirty = false;
        }
        return this.#state.transposedMatrix;
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

        const boundary = view.viewport.boundary;
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

        math.orthoMat4c(left, right, bottom, top, this.#state.near, this.#state.far, this.#state.matrix);

        this.#inverseMatrixDirty = true;
        this.#transposedMatrixDirty = true;

        this.camera.view.redraw();

        this.events.fire("matrix", this.#state.matrix);
    }

    /**
     * Un-projects the given Canvas-space coordinates, using this Ortho projection.
     *
     * @param canvasPos Inputs 2D Canvas-space coordinates.
     * @param screenZ Inputs Screen-space Z coordinate.
     * @param screenPos Outputs 3D Screen/Clip-space coordinates.
     * @param viewPos Outputs un-projected 3D View-space coordinates.
     * @param worldPos Outputs un-projected 3D World-space coordinates.
     */
    unproject(
        canvasPos: math.FloatArrayParam,
        screenZ: number,
        screenPos: math.FloatArrayParam,
        viewPos: math.FloatArrayParam,
        worldPos: math.FloatArrayParam): math.FloatArrayParam {

        const canvas = this.camera.view.canvas.canvas;

        const halfCanvasWidth = canvas.offsetWidth / 2.0;
        const halfCanvasHeight = canvas.offsetHeight / 2.0;

        screenPos[0] = (canvasPos[0] - halfCanvasWidth) / halfCanvasWidth;
        screenPos[1] = (canvasPos[1] - halfCanvasHeight) / halfCanvasHeight;
        screenPos[2] = screenZ;
        screenPos[3] = 1.0;

        math.mulMat4v4(this.inverseMatrix, screenPos, viewPos);
        math.mulVec3Scalar(viewPos, 1.0 / viewPos[3]);

        viewPos[3] = 1.0;
        viewPos[1] *= -1;

        math.mulMat4v4(this.camera.inverseViewMatrix, viewPos, worldPos);

        return worldPos;
    }

    /** @private
     *
     */
    destroy() {
        super.destroy();
        this.camera.view.canvas.events.off(this.#onCanvasBoundary);
    }
}

export {Ortho};