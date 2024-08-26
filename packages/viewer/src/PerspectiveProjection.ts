import {EventDispatcher} from "strongly-typed-events";
import type {Camera} from "./Camera";
import {Component, EventEmitter} from "@xeokit/core";
import {PerspectiveProjectionType} from "@xeokit/constants";
import type {FloatArrayParam} from "@xeokit/math";
import {inverseMat4, createMat4, mulMat4v4, mulVec3Scalar, perspectiveMat4, transposeMat4} from "@xeokit/matrix";
import {Projection} from "./Projection";

/**
 * PerspectiveProjection projection configuration for a {@link @xeokit/viewer!Camera | Camera} .
 *
 * ## Summary
 *
 * * Located at {@link @xeokit/viewer!Camera.perspectiveProjection | Camera.perspectiveProjection}.
 * * Implicitly sets the left, right, top, bottom frustum planes using {@link @xeokit/viewer!PerspectiveProjection.fov | PerspectiveProjection.fov}.
 * * {@link @xeokit/viewer!PerspectiveProjection.near | PerspectiveProjection.near} and {@link @xeokit/viewer!PerspectiveProjection.far| PerspectiveProjection.far} specify the distances to the clipping planes.
 * * {@link @xeokit/viewer!PerspectiveProjection.onProjMatrix | PerspectiveProjection.onProjMatrix} will fire an event whenever {@link @xeokit/viewer!PerspectiveProjection.projMatrix | PerspectiveProjection.projMatrix} updates, which indicates that one or more other properties have updated.
 */
export class PerspectiveProjection extends Component implements Projection {

    /**
     * The Camera this PerspectiveProjection belongs to.
     */
    public readonly camera: Camera;

    /**
     * Emits an event each time {@link @xeokit/viewer!PerspectiveProjection.projMatrix | PerspectiveProjection.projMatrix} updates.
     *
     * @event
     */
    readonly onProjMatrix: EventEmitter<PerspectiveProjection, FloatArrayParam>;

    /**
     * The type of this projection.
     */
    static readonly type: number = PerspectiveProjectionType;

    #state: {
        far: number;
        near: number;
        fov: number;
        fovAxis: string;
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
        fov?: number,
        fovAxis?: string,
        near?: number,
        far?: number
    } = {}) {

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

        this.#onViewBoundary = this.camera.view.onBoundary.subscribe( () => {
            this.setDirty();
        });

        this.onProjMatrix = new EventEmitter(new EventDispatcher<PerspectiveProjection, FloatArrayParam>());
    }

    /**
     * Gets the PerspectiveProjection's field-of-view angle (FOV).
     *
     * Default value is ````60.0````.
     *
     * @returns {Number} Current field-of-view.
     */
    get fov(): number {
        return this.#state.fov;
    }

    /**
     * Sets the PerspectiveProjection's field-of-view angle (FOV).
     *
     * Default value is ````60.0````.
     *
     * @param value New field-of-view.
     */
    set fov(value: number) {
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
    get fovAxis(): string {
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
    set fovAxis(value: string) {
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
    get near(): number {
        return this.#state.near;
    }

    /**
     * Sets the position of the PerspectiveProjection's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @param value New PerspectiveProjection near plane position.
     */
    set near(value: number) {
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
    get far(): number {
        return this.#state.far;
    }

    /**
     * Sets the position of this PerspectiveProjection's far plane on the positive View-space Z-axis.
     *
     * @param value New PerspectiveProjection far plane position.
     */
    set far(value: number) {
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
    get projMatrix(): FloatArrayParam {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        return this.#state.projMatrix;
    }

    /**
     * Gets the inverse of {@link @xeokit/viewer!PerspectiveProjection.projMatrix | PerspectiveProjection.projMatrix}.
     *
     * @returns  The inverse of {@link @xeokit/viewer!PerspectiveProjection.projMatrix | PerspectiveProjection.projMatrix}.
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
     * Gets the transpose of {@link @xeokit/viewer!PerspectiveProjection.projMatrix | PerspectiveProjection.projMatrix}.
     *
     * @returns  The transpose of {@link @xeokit/viewer!PerspectiveProjection.projMatrix | PerspectiveProjection.projMatrix}.
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
    unproject(canvasPos: FloatArrayParam, screenZ: number, screenPos: FloatArrayParam, viewPos: FloatArrayParam, worldPos: FloatArrayParam): FloatArrayParam {

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
