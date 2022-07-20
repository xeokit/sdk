import * as math from '../../math/';
import {Component} from '../../Component';
import {Camera} from "./Camera";

/**
 * Perspective projection configuration for a {@link Camera}.
 *
 * ## Summary
 *
 * * Located at {@link Camera.perspective}.
 * * Implicitly sets the left, right, top, bottom frustum planes using {@link Perspective.fov}.
 * * {@link Perspective.near} and {@link Perspective.far} specify the distances to the clipping planes.
 */
class Perspective extends Component {

    /**
     * The Camera this Perspective belongs to.
     */
    public readonly camera: Camera;

    public readonly state: {
        transposedMatrix: math.FloatArrayType;
        far: number;
        near: number;
        matrix: math.FloatArrayType;
        inverseMatrix: math.FloatArrayType;
        fov: number;
        fovAxis: string;
    };

    private inverseMatrixDirty: boolean;
    private transposedMatrixDirty: boolean;
    private onCanvasBoundary: any;

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

        this.state = {
            matrix: math.mat4(),
            inverseMatrix: math.mat4(),
            transposedMatrix: math.mat4(),
            near: cfg.near || 0.1,
            far: cfg.far || 2000.0,
            fov: cfg.fov || 60.0,
            fovAxis: cfg.fovAxis || "min"
        };

        this.inverseMatrixDirty = true;
        this.transposedMatrixDirty = true;

        this.onCanvasBoundary = this.camera.view.canvas.events.on("boundary", () => {
            this.setDirty();
        });
    }

    /**
     * Gets the Perspective's field-of-view angle (FOV).
     *
     * Default value is ````60.0````.
     *
     * @returns {Number} Current field-of-view.
     */
    get fov(): number {
        return this.state.fov;
    }

    /**
     * Sets the Perspective's field-of-view angle (FOV).
     *
     * Fires an "fov" event on change.

     * Default value is ````60.0````.
     *
     * @param value New field-of-view.
     */
    set fov(value: number) {
        if (value === this.state.fov) {
            return;
        }
        this.state.fov = value;
        this.setDirty();
        this.events.fire("fov", this.state.fov);
    }

    /**
     * Gets the Perspective's FOV axis.
     *
     * Options are ````"x"````, ````"y"```` or ````"min"````, to use the minimum axis.
     *
     * Fires an "fovAxis" event on change.

     * Default value is ````"min"````.
     *
     * @returns {String} The current FOV axis value.
     */
    get fovAxis(): string {
        return this.state.fovAxis;
    }

    /**
     * Sets the Perspective's FOV axis.
     *
     * Options are ````"x"````, ````"y"```` or ````"min"````, to use the minimum axis.
     *
     * Fires an "fovAxis" event on change.

     * Default value ````"min"````.
     *
     * @param value New FOV axis value.
     */
    set fovAxis(value: string) {
        value = value || "min";
        if (this.state.fovAxis === value) {
            return;
        }
        if (value !== "x" && value !== "y" && value !== "min") {
            this.error("Unsupported value for 'fovAxis': " + value + " - defaulting to 'min'");
            value = "min";
        }
        this.state.fovAxis = value;
        this.setDirty(); 
        this.events.fire("fovAxis", this.state.fovAxis);
    }

    /**
     * Gets the position of the Perspective's near plane on the positive View-space Z-axis.
     *
     * Fires an "emits" emits on change.
     *
     * Default value is ````0.1````.
     *
     * @returns The Perspective's near plane position.
     */
    get near(): number {
        return this.state.near;
    }

    /**
     * Sets the position of the Perspective's near plane on the positive View-space Z-axis.
     *
     * Fires a "near" event on change.
     *
     * Default value is ````0.1````.
     *
     * @param value New Perspective near plane position.
     */
    set near(value: number) {
        if (this.state.near === value) {
            return;
        }
        this.state.near = value;
        this.setDirty(); 
        this.events.fire("near", this.state.near);
    }

    /**
     * Gets the position of this Perspective's far plane on the positive View-space Z-axis.
     *
     * @return {Number} The Perspective's far plane position.
     */
    get far(): number {
        return this.state.far;
    }

    /**
     * Sets the position of this Perspective's far plane on the positive View-space Z-axis.
     *
     * Fires a "far" event on change.
     *
     * @param value New Perspective far plane position.
     */
    set far(value: number) {
        if (this.state.far === value) {
            return;
        }
        this.state.far = value;
        this.setDirty(); 
        this.events.fire("far", this.state.far);
    }

    /**
     * Gets the Perspective's projection transform matrix.
     *
     * Fires a "matrix" event on change.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @returns  The Perspective's projection matrix.
     */
    get matrix(): math.FloatArrayType {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        return this.state.matrix;
    }

    /**
     * Gets the inverse of {@link Perspective.matrix}.
     *
     * @returns  The inverse of {@link Perspective.matrix}.
     */
    get inverseMatrix(): math.FloatArrayType {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        if (this.inverseMatrixDirty) {
            math.inverseMat4(this.state.matrix, this.state.inverseMatrix);
            this.inverseMatrixDirty = false;
        }
        return this.state.inverseMatrix;
    }

    /**
     * Gets the transpose of {@link Perspective.matrix}.
     *
     * @returns  The transpose of {@link Perspective#matrix}.
     */
    get transposedMatrix(): math.FloatArrayType {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        if (this.transposedMatrixDirty) {
            math.transposeMat4(this.state.matrix, this.state.transposedMatrix);
            this.transposedMatrixDirty = false;
        }
        return this.state.transposedMatrix;
    }

    clean() {
        const WIDTH_INDEX = 2;
        const HEIGHT_INDEX = 3;
        const boundary = this.camera.view.viewport.boundary;
        const aspect = boundary[WIDTH_INDEX] / boundary[HEIGHT_INDEX];
        const fovAxis = this.state.fovAxis;
        let fov = this.state.fov;
        if (fovAxis === "x" || (fovAxis === "min" && aspect < 1) || (fovAxis === "max" && aspect > 1)) {
            fov = fov / aspect;
        }
        fov = Math.min(fov, 120);
        math.perspectiveMat4(fov * (Math.PI / 180.0), aspect, this.state.near, this.state.far, this.state.matrix);
        this.inverseMatrixDirty = true;
        this.transposedMatrixDirty = true;
        this.camera.view.redraw();
        this.events.fire("matrix", this.state.matrix);
    }

    /**
     * Un-projects the given Canvas-space coordinates and Screen-space depth, using this Perspective projection.
     *
     * @param canvasPos Inputs 2D Canvas-space coordinates.
     * @param screenZ Inputs Screen-space Z coordinate.
     * @param screenPos Outputs 3D Screen/Clip-space coordinates.
     * @param viewPos Outputs un-projected 3D View-space coordinates.
     * @param worldPos Outputs un-projected 3D World-space coordinates.
     */
    unproject(canvasPos: math.FloatArrayType, screenZ: number, screenPos: math.FloatArrayType, viewPos: math.FloatArrayType, worldPos: math.FloatArrayType): math.FloatArrayType {

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
        this.camera.view.canvas.events.off(this.onCanvasBoundary);
        super.destroy();
    }
}

export {Perspective};