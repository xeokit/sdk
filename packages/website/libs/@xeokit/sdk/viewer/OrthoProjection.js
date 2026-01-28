import { EventDispatcher } from "strongly-typed-events";
import { Component, EventEmitter } from "../core";
import { OrthoProjectionType } from "../constants";
import { createMat4, inverseMat4, mulMat4v4, mulVec3Scalar, orthoMat4c, transposeMat4 } from "../matrix";
/**
 * Orthographic projection configuration for a {@link viewer!Camera | Camera} .
 *
 * * Located at {@link viewer!Camera.orthoProjection | Camera.orthoProjection}.
 * * Works like Blender's orthographic projection, where the positions of the left, right, top and bottom planes are implicitly
 * indicated with a single {@link viewer!OrthoProjection.scale | OrthoProjection.scale} property, which causes the frustum to be symmetrical on X and Y axis, large enough to
 * contain the number of units given by {@link viewer!OrthoProjection.scale | OrthoProjection.scale}.
 * * {@link viewer!OrthoProjection.near | OrthoProjection.near} and {@link viewer!OrthoProjection.far | OrthoProjection.far} indicated the distances to the clipping planes.
 * * {@link viewer!OrthoProjection.onProjMatrix | OrthoProjection.onProjMatrix} will fire an event whenever {@link viewer!OrthoProjection.projMatrix | OrthoProjection.projMatrix} updates, which indicates that one or more other properties have updated.
 */
export class OrthoProjection extends Component {
    /**
     * The Camera this OrthoProjection belongs to.
     */
    camera;
    /**
     * Emits an event each time {@link viewer!OrthoProjection.projMatrix | OrthoProjection.projMatrix} updates.
     *
     * @event
     */
    onProjMatrix;
    /**
     * The type of this projection.
     */
    static type = OrthoProjectionType;
    #state;
    #inverseMatrixDirty;
    #transposedProjMatrixDirty;
    #onViewBoundary;
    /**
     * @private
     */
    constructor(camera, cfg = {}) {
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
        this.onProjMatrix = new EventEmitter(new EventDispatcher());
        this.#inverseMatrixDirty = true;
        this.#transposedProjMatrixDirty = true;
        this.#onViewBoundary = this.camera.view.onBoundary.subscribe(() => {
            this.setDirty();
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
    get scale() {
        return this.#state.scale;
    }
    /**
     * Sets scale factor for this OrthoProjection's extents on X and Y axis.
     *
     * Clamps to minimum value of ````0.01```.
     *
     * Default value is ````1.0````
     * @param value New scale value.
     */
    set scale(value) {
        if (value <= 0) {
            value = 0.01;
        }
        this.#state.scale = value;
        this.setDirty();
    }
    /**
     * Gets the position of the OrthoProjection's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * returns New OrthoProjection near plane position.
     */
    get near() {
        return this.#state.near;
    }
    /**
     * Sets the position of the OrthoProjection's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @param value New OrthoProjection near plane position.
     */
    set near(value) {
        if (this.#state.near === value) {
            return;
        }
        this.#state.near = value;
        this.setDirty();
    }
    /**
     * Gets the position of the OrthoProjection's far plane on the positive View-space Z-axis.
     *
     * Default value is ````10000.0````.
     *
     * returns New far ortho plane position.
     */
    get far() {
        return this.#state.far;
    }
    /**
     * Sets the position of the OrthoProjection's far plane on the positive View-space Z-axis.
     *
     * Default value is ````2000.0````.
     *
     * @param value New far ortho plane position.
     */
    set far(value) {
        if (this.#state.far === value) {
            return;
        }
        this.#state.far = value;
        this.setDirty();
    }
    /**
     * Gets the OrthoProjection's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @returns  The OrthoProjection's projection matrix.
     */
    get projMatrix() {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        return this.#state.projMatrix;
    }
    /**
     * Gets the inverse of {@link viewer!OrthoProjection.projMatrix | OrthoProjection.projMatrix}.
     *
     * @returns  The inverse of {@link viewer!OrthoProjection.projMatrix | OrthoProjection.projMatrix}.
     */
    get inverseProjMatrix() {
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
     * Gets the transpose of {@link viewer!OrthoProjection.projMatrix | OrthoProjection.projMatrix}.
     *
     * @returns  The transpose of {@link viewer!OrthoProjection.projMatrix | OrthoProjection.projMatrix}.
     */
    get transposedProjMatrix() {
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
        }
        else {
            left = -halfSize * aspect;
            right = halfSize * aspect;
            top = halfSize;
            bottom = -halfSize;
        }
        orthoMat4c(left, right, bottom, top, this.#state.near, this.#state.far, this.#state.projMatrix);
        this.#inverseMatrixDirty = true;
        this.#transposedProjMatrixDirty = true;
        this.camera.view.needsRedraw();
        this.onProjMatrix.dispatch(this, this.#state.projMatrix);
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
    unproject(canvasPos, screenZ, screenPos, viewPos, worldPos) {
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
    /** @private
     *
     */
    destroy() {
        super.destroy();
        this.camera.view.onBoundary.unsubscribe(this.#onViewBoundary);
        this.onProjMatrix.clear();
    }
}
//# sourceMappingURL=OrthoProjection.js.map
