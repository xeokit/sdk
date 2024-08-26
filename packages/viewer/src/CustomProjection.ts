
import {EventDispatcher} from "strongly-typed-events";

import type {Camera} from "./Camera";
import {Component, EventEmitter} from "@xeokit/core";
import type {FloatArrayParam} from "@xeokit/math";
import {CustomProjectionType} from "@xeokit/constants";
import {identityMat4, inverseMat4, createMat4, mulMat4v4, mulVec3Scalar, transposeMat4} from "@xeokit/matrix";
import {Projection} from "./Projection";

/**
 * Configures a custom projection for a {@link @xeokit/viewer!Camera | Camera} .
 *
 * * Located at {@link Camera.customProjection}.
 * * {@link CustomProjection.onProjMatrix} will fire an event whenever {@link CustomProjection.projMatrix} updates, which indicates that one or more other properties have updated.
 */
class CustomProjection  extends Component implements Projection {

    /**
     * The Camera this CustomProjection belongs to.
     */
    public readonly camera: Camera;

    /**
     * Emits an event each time {@link CustomProjection.projMatrix} updates.
     *
     * @event
     */
    readonly onProjMatrix: EventEmitter<CustomProjection, FloatArrayParam>;

    /**
     * The type of this projection.
     */
    static readonly type: number = CustomProjectionType;

    #state: {
        projMatrix: FloatArrayParam;
        transposedProjMatrix: FloatArrayParam;
        inverseProjMatrix: FloatArrayParam
    };

    #inverseProjMatrixDirty: boolean;
    #transposedProjMatrixDirty: boolean;

    /**
     * @private
     */
    constructor(camera: Camera, cfg: {
        projMatrix?: FloatArrayParam
    } = {}) {

        super(camera, cfg);

        this.camera = camera;

        this.#state = {
            projMatrix: createMat4(cfg.projMatrix || identityMat4()),
            inverseProjMatrix: createMat4(),
            transposedProjMatrix: createMat4()
        };

        this.onProjMatrix = new EventEmitter(new EventDispatcher<CustomProjection, FloatArrayParam>());

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
    get projMatrix(): FloatArrayParam {
        return this.#state.projMatrix;
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
    get inverseProjMatrix(): FloatArrayParam {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        if (this.#inverseProjMatrixDirty) {
            inverseMat4(this.#state.projMatrix, this.#state.inverseProjMatrix);
            this.#inverseProjMatrixDirty = false;
        }
        return this.#state.inverseProjMatrix;
    }

    /**
     * Gets the transpose of {@link CustomProjection.projMatrix}.
     *
     * @returns The transpose of {@link CustomProjection.projMatrix}.
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

    /** @private
     *
     */
    destroy() {
        super.destroy();
        this.onProjMatrix.clear();
    }
}

export {CustomProjection};
