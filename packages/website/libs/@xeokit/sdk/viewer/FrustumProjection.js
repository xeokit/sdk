import { EventDispatcher } from "strongly-typed-events";
import { Component, EventEmitter } from "../core";
import { FrustumProjectionType } from "../constants";
import { createMat4, frustumMat4, inverseMat4, mulMat4v4, mulVec3Scalar, transposeMat4 } from "../matrix";
/**
 *  FrustumProjection-based perspective projection configuration for a {@link viewer!Camera | Camera} .
 *
 * * Located at {@link Camera.frustumProjection}.
 * * Allows to explicitly set the positions of the left, right, top, bottom, near and far planes, which is useful for asymmetrical view volumes, such as for stereo viewing.
 * * {@link FrustumProjection.near} and {@link FrustumProjection.far} specify the distances to the clipping planes.
 * * {@link FrustumProjection.onProjMatrix} will fire an event whenever {@link FrustumProjection.projMatrix} updates, which indicates that one or more other properties have updated.
 */
export class FrustumProjection extends Component {
    /**
     * The type of this projection.
     */
    static type = FrustumProjectionType;
    /**
     * The Camera this FrustumProjection belongs to.
     */
    camera;
    /**
     * Emits an event each time {@link FrustumProjection.projMatrix} updates.
     *
     * @event
     */
    onProjMatrix;
    #state;
    #inverseMatrixDirty;
    #transposedProjMatrixDirty;
    /**
     * @private
     */
    constructor(camera, cfg = {}) {
        super(camera, cfg);
        this.camera = camera;
        this.#state = {
            projMatrix: createMat4(),
            inverseProjMatrix: createMat4(),
            transposedProjMatrix: createMat4(),
            near: 0.1,
            far: 10000.0,
            left: (cfg.left !== undefined && cfg.left !== null) ? cfg.left : -1.0,
            right: (cfg.right !== undefined && cfg.right !== null) ? cfg.right : 1.0,
            bottom: (cfg.bottom !== undefined && cfg.bottom !== null) ? cfg.bottom : -1.0,
            top: (cfg.top !== undefined && cfg.top !== null) ? cfg.top : 1.0
        };
        this.onProjMatrix = new EventEmitter(new EventDispatcher());
        this.#inverseMatrixDirty = true;
        this.#transposedProjMatrixDirty = true;
    }
    /**
     * Gets the position of the FrustumProjection's left plane on the View-space X-axis.
     *
     * @return {Number} Left frustum plane position.
     */
    get left() {
        return this.#state.left;
    }
    /**
     * Sets the position of the FrustumProjection's left plane on the View-space X-axis.
     *
     * @param value New left frustum plane position.
     */
    set left(value) {
        this.#state.left = value;
        this.setDirty();
    }
    /**
     * Gets the position of the FrustumProjection's right plane on the View-space X-axis.
     *
     * @return {Number} Right frustum plane position.
     */
    get right() {
        return this.#state.right;
    }
    /**
     * Sets the position of the FrustumProjection's right plane on the View-space X-axis.
     *
     * @param value New right frustum plane position.
     */
    set right(value) {
        this.#state.right = value;
        this.setDirty();
    }
    /**
     * Gets the position of the FrustumProjection's top plane on the View-space Y-axis.
     *
     * @return {Number} Top frustum plane position.
     */
    get top() {
        return this.#state.top;
    }
    /**
     * Sets the position of the FrustumProjection's top plane on the View-space Y-axis.
     *
     * @param value New top frustum plane position.
     */
    set top(value) {
        this.#state.top = value;
        this.setDirty();
    }
    /**
     * Gets the position of the FrustumProjection's bottom plane on the View-space Y-axis.
     *
     * @return {Number} Bottom frustum plane position.
     */
    get bottom() {
        return this.#state.bottom;
    }
    /**
     * Sets the position of the FrustumProjection's bottom plane on the View-space Y-axis.
     *
     * @param value New bottom frustum plane position.
     */
    set bottom(value) {
        this.#state.bottom = value;
        this.setDirty();
    }
    /**
     * Gets the position of the FrustumProjection's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @return {Number} Near frustum plane position.
     */
    get near() {
        return this.#state.near;
    }
    /**
     * Sets the position of the FrustumProjection's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @param value New FrustumProjection near plane position.
     */
    set near(value) {
        this.#state.near = value;
        this.setDirty();
    }
    /**
     * Gets the position of the FrustumProjection's far plane on the positive View-space Z-axis.
     *
     * Default value is ````10000.0````.
     *
     * @return {Number} Far frustum plane position.
     */
    get far() {
        return this.#state.far;
    }
    /**
     * Sets the position of the FrustumProjection's far plane on the positive View-space Z-axis.
     *
     * Default value is ````10000.0````.
     *
     * @param value New far frustum plane position.
     */
    set far(value) {
        this.#state.far = value;
        this.setDirty();
    }
    /**
     * Gets the FrustumProjection's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @returns The FrustumProjection's projection matrix
     */
    get projMatrix() {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        return this.#state.projMatrix;
    }
    /**
     * Gets the inverse of {@link FrustumProjection.projMatrix}.
     *
     * @returns  The inverse orthographic projection projMatrix.
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
     * Gets the transpose of {@link FrustumProjection.projMatrix}.
     *
     * @returns The transpose of {@link FrustumProjection.projMatrix}.
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
        frustumMat4(this.#state.left, this.#state.right, this.#state.bottom, this.#state.top, this.#state.near, this.#state.far, this.#state.projMatrix);
        this.#inverseMatrixDirty = true;
        this.#transposedProjMatrixDirty = true;
        this.camera.view.needsRedraw();
        this.onProjMatrix.dispatch(this, this.#state.projMatrix);
    }
    /**
     * Un-projects the given View-space coordinates, using this FrustumProjection projection.
     *
     * @param canvasPos Inputs 2D View-space coordinates.
     * @param screenZ Inputs Screen-space Z coordinate.
     * @param screenPos Outputs 3D Screen/Clip-space coordinates.
     * @param viewPos Outputs un-projected 3D View-space coordinates.
     * @param worldPos Outputs un-projected 3D World-space coordinates.
     */
    unproject(canvasPos, screenZ, screenPos, viewPos, worldPos) {
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
//# sourceMappingURL=FrustumProjection.js.map
