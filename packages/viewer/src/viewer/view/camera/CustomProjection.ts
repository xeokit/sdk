import * as math from '../../math/index';
import {Component} from '../../Component';
import type {Camera} from "./Camera";

/**
 * Configures a custom projection for a {@link Camera}.
 *
 * Located at {@link Camera.customProjection}.
 */
class CustomProjection extends Component {

    /**
     * The Camera this CustomProjection belongs to.
     */
    public readonly camera: Camera;

    #state: {
        matrix: math.FloatArrayParam;
        transposedMatrix: math.FloatArrayParam;
        inverseMatrix: math.FloatArrayParam
    };

    #inverseMatrixDirty: boolean;
    #transposedMatrixDirty: boolean;

    /**
     * @private
     */
    constructor(camera: Camera, cfg: {
        matrix?: math.FloatArrayParam
    } = {}) {

        super(camera, cfg);

        this.camera = camera;

        this.#state = {
            matrix: math.mat4(cfg.matrix || math.identityMat4()),
            inverseMatrix: math.mat4(),
            transposedMatrix: math.mat4()
        };

        this.#inverseMatrixDirty = true;
        this.#transposedMatrixDirty = false;
    }

    /**
     * Gets the CustomProjection's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @return  New value for the CustomProjection's matrix.
     */
    get matrix(): math.FloatArrayParam {
        return this.#state.matrix;
    }

    /**
     * Sets the CustomProjection's projection transform matrix.
     *
     * Fires a "matrix" event on change.

     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @param matrix New value for the CustomProjection's matrix.
     */
    set matrix(matrix: math.FloatArrayParam) {
        // @ts-ignore
        this.#state.matrix.set(matrix);
        this.#inverseMatrixDirty = true;
        this.#transposedMatrixDirty = true;
        this.setDirty();
        this.camera.view.redraw();
        this.events.fire("matrix", this.#state.matrix);
    }

    /**
     * Gets the inverse of {@link CustomProjection.matrix}.
     *
     * @returns The inverse of {@link CustomProjection.matrix}.
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
     * Gets the transpose of {@link CustomProjection.matrix}.
     *
     * @returns The transpose of {@link CustomProjection.matrix}.
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
     * Un-projects the given Canvas-space coordinates, using this CustomProjection.
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
        worldPos: math.FloatArrayParam) {
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
    }
}

export {CustomProjection};