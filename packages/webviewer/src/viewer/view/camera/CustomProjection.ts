import * as math from '../../math/index';
import {Component} from '../../Component';
import type {Camera} from "./Camera";
import {EventEmitter} from "./../../EventEmitter";
import {EventDispatcher} from "strongly-typed-events";
import {CustomProjectionType} from "../../constants";

/**
 * Configures a custom projection for a {@link Camera}.
 *
 * * Located at {@link Camera.customProjection}.
 * * {@link CustomProjection.onProjMatrix} will fire an event whenever {@link CustomProjection.projMatrix} updates, which indicates that one or more other properties have updated.
 */
class CustomProjection extends Component {

    /**
     * The Camera this CustomProjection belongs to.
     */
    public readonly camera: Camera;

    /**
     * Emits an event each time {@link CustomProjection.projMatrix} updates.
     *
     * @event
     */
    readonly onProjMatrix: EventEmitter<CustomProjection, math.FloatArrayParam>;

    /**
     * The type of this projection.
     */
    static readonly type: number = CustomProjectionType;
    
    #state: {
        projMatrix: math.FloatArrayParam;
        transposedProjMatrix: math.FloatArrayParam;
        inverseProjMatrix: math.FloatArrayParam
    };

    #inverseProjMatrixDirty: boolean;
    #transposedProjMatrixDirty: boolean;

    /**
     * @private
     */
    constructor(camera: Camera, cfg: {
        projMatrix?: math.FloatArrayParam
    } = {}) {

        super(camera, cfg);

        this.camera = camera;

        this.#state = {
            projMatrix: math.mat4(cfg.projMatrix || math.identityMat4()),
            inverseProjMatrix: math.mat4(),
            transposedProjMatrix: math.mat4()
        };

        this.onProjMatrix = new EventEmitter(new EventDispatcher<CustomProjection, math.FloatArrayParam>());

        this.#inverseProjMatrixDirty = true;
        this.#transposedProjMatrixDirty = false;
    }

    /**
     * Gets the CustomProjection's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @return  New value for the CustomProjection's matrix.
     */
    get projMatrix(): math.FloatArrayParam {
        return this.#state.projMatrix;
    }

    /**
     * Sets the CustomProjection's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @param projMatrix New value for the CustomProjection's matrix.
     */
    set projMatrix(projMatrix: math.FloatArrayParam) {
        // @ts-ignore
        this.#state.projMatrix.set(projMatrix);
        this.#inverseProjMatrixDirty = true;
        this.#transposedProjMatrixDirty = true;
        this.setDirty();
        this.camera.view.redraw();
        this.onProjMatrix.dispatch(this, this.#state.projMatrix);
    }

    /**
     * Gets the inverse of {@link CustomProjection.projMatrix}.
     *
     * @returns The inverse of {@link CustomProjection.projMatrix}.
     */
    get inverseProjMatrix(): math.FloatArrayParam {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        if (this.#inverseProjMatrixDirty) {
            math.inverseMat4(this.#state.projMatrix, this.#state.inverseProjMatrix);
            this.#inverseProjMatrixDirty = false;
        }
        return this.#state.inverseProjMatrix;
    }

    /**
     * Gets the transpose of {@link CustomProjection.projMatrix}.
     *
     * @returns The transpose of {@link CustomProjection.projMatrix}.
     */
    get transposedProjMatrix(): math.FloatArrayParam {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        if (this.#transposedProjMatrixDirty) {
            math.transposeMat4(this.#state.projMatrix, this.#state.transposedProjMatrix);
            this.#transposedProjMatrixDirty = false;
        }
        return this.#state.transposedProjMatrix;
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
        math.mulMat4v4(this.inverseProjMatrix, screenPos, viewPos);
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
        this.onProjMatrix.clear();
    }
}

export {CustomProjection};