import { EventDispatcher } from "strongly-typed-events";
import { Component, EventEmitter } from "../core";
import { PerspectiveProjectionType } from "../constants";
import { inverseMat4, createMat4, mulMat4v4, mulVec3Scalar, perspectiveMat4, transposeMat4 } from "../matrix";
/**
 * PerspectiveProjection projection configuration for a {@link viewer!Camera | Camera} .
 *
 * ## Summary
 *
 * * Located at {@link viewer!Camera.perspectiveProjection | Camera.perspectiveProjection}.
 * * Implicitly sets the left, right, top, bottom frustum planes using {@link viewer!PerspectiveProjection.fov | PerspectiveProjection.fov}.
 * * {@link viewer!PerspectiveProjection.near | PerspectiveProjection.near} and {@link viewer!PerspectiveProjection.far| PerspectiveProjection.far} specify the distances to the clipping planes.
 * * {@link viewer!PerspectiveProjection.onProjMatrix | PerspectiveProjection.onProjMatrix} will fire an event whenever {@link viewer!PerspectiveProjection.projMatrix | PerspectiveProjection.projMatrix} updates, which indicates that one or more other properties have updated.
 */
export class PerspectiveProjection extends Component {
    /**
     * The Camera this PerspectiveProjection belongs to.
     */
    camera;
    /**
     * Emits an event each time {@link viewer!PerspectiveProjection.projMatrix | PerspectiveProjection.projMatrix} updates.
     *
     * @event
     */
    onProjMatrix;
    /**
     * The type of this projection.
     */
    static type = PerspectiveProjectionType;
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
            far: cfg.far || 10000.0,
            fov: cfg.fov || 60.0,
            fovAxis: cfg.fovAxis || "min",
            projMatrix: createMat4(),
            inverseProjMatrix: createMat4(),
            transposedProjMatrix: createMat4()
        };
        this.#inverseMatrixDirty = true;
        this.#transposedProjMatrixDirty = true;
        this.#onViewBoundary = this.camera.view.onBoundary.subscribe(() => {
            this.setDirty();
        });
        this.onProjMatrix = new EventEmitter(new EventDispatcher());
    }
    /**
     * Gets the PerspectiveProjection's field-of-view angle (FOV).
     *
     * Default value is ````60.0````.
     *
     * @returns {Number} Current field-of-view.
     */
    get fov() {
        return this.#state.fov;
    }
    /**
     * Sets the PerspectiveProjection's field-of-view angle (FOV).
     *
     * Default value is ````60.0````.
     *
     * @param value New field-of-view.
     */
    set fov(value) {
        if (value === this.#state.fov) {
            return;
        }
        this.#state.fov = value;
        this.setDirty();
    }
    /**
     * Gets the PerspectiveProjection's FOV axis.
     *
     * Options are ````"x"````, ````"y"```` or ````"min"````, to use the minimum axis.
     *
     * Default value is ````"min"````.
     *
     * @returns {String} The current FOV axis value.
     */
    get fovAxis() {
        return this.#state.fovAxis;
    }
    /**
     * Sets the PerspectiveProjection's FOV axis.
     *
     * Options are ````"x"````, ````"y"```` or ````"min"````, to use the minimum axis.
     *
     * Default value ````"min"````.
     *
     * @param value New FOV axis value.
     */
    set fovAxis(value) {
        value = value || "min";
        if (this.#state.fovAxis === value) {
            return;
        }
        if (value !== "x" && value !== "y" && value !== "min") {
            this.error("Unsupported value for 'fovAxis': " + value + " - defaulting to 'min'");
            value = "min";
        }
        this.#state.fovAxis = value;
        this.setDirty();
    }
    /**
     * Gets the position of the PerspectiveProjection's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @returns The PerspectiveProjection's near plane position.
     */
    get near() {
        return this.#state.near;
    }
    /**
     * Sets the position of the PerspectiveProjection's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @param value New PerspectiveProjection near plane position.
     */
    set near(value) {
        if (this.#state.near === value) {
            return;
        }
        this.#state.near = value;
        this.setDirty();
    }
    /**
     * Gets the position of this PerspectiveProjection's far plane on the positive View-space Z-axis.
     *
     * @return {Number} The PerspectiveProjection's far plane position.
     */
    get far() {
        return this.#state.far;
    }
    /**
     * Sets the position of this PerspectiveProjection's far plane on the positive View-space Z-axis.
     *
     * @param value New PerspectiveProjection far plane position.
     */
    set far(value) {
        if (this.#state.far === value) {
            return;
        }
        this.#state.far = value;
        this.setDirty();
    }
    /**
     * Gets the PerspectiveProjection's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @returns  The PerspectiveProjection's projection matrix.
     */
    get projMatrix() {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        return this.#state.projMatrix;
    }
    /**
     * Gets the inverse of {@link viewer!PerspectiveProjection.projMatrix | PerspectiveProjection.projMatrix}.
     *
     * @returns  The inverse of {@link viewer!PerspectiveProjection.projMatrix | PerspectiveProjection.projMatrix}.
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
     * Gets the transpose of {@link viewer!PerspectiveProjection.projMatrix | PerspectiveProjection.projMatrix}.
     *
     * @returns  The transpose of {@link viewer!PerspectiveProjection.projMatrix | PerspectiveProjection.projMatrix}.
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
        const boundary = this.camera.view.boundary;
        const aspect = boundary[WIDTH_INDEX] / boundary[HEIGHT_INDEX];
        const fovAxis = this.#state.fovAxis;
        let fov = this.#state.fov;
        if (fovAxis === "x" || (fovAxis === "min" && aspect < 1) || (fovAxis === "max" && aspect > 1)) {
            fov = fov / aspect;
        }
        fov = Math.min(fov, 120);
        perspectiveMat4(fov * (Math.PI / 180.0), aspect, this.#state.near, this.#state.far, this.#state.projMatrix);
        this.#inverseMatrixDirty = true;
        this.#transposedProjMatrixDirty = true;
        this.camera.view.redraw();
        this.onProjMatrix.dispatch(this, this.#state.projMatrix);
    }
    /**
     * Un-projects the given View-space coordinates and Screen-space depth, using this PerspectiveProjection projection.
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
        this.camera.view.onBoundary.unsubscribe(this.#onViewBoundary);
        this.onProjMatrix.clear();
    }
}
//# sourceMappingURL=PerspectiveProjection.js.map