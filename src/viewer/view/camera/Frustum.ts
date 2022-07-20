import {Component} from '../../Component';
import {Camera} from "./Camera";
import * as math from '../../math/';

/**
 *  Perspective projection configuration for a {@link Camera}, as a frustum.
 *
 * * Located at {@link Camera#frustum}.
 * * Allows to explicitly set the positions of the left, right, top, bottom, near and far planes, which is useful for asymmetrical view volumes, such as for stereo viewing.
 * * {@link Frustum#near} and {@link Frustum#far} specify the distances to the clipping planes.
 */
class Frustum extends Component {

    /**
     * The Camera this Frustum belongs to.
     */
    public readonly camera: Camera;

    public readonly state: {
        transposedMatrix: math.FloatArrayType;
        far: number;
        near: number;
        left: number;
        right: number;
        bottom: number;
        top: number;
        matrix: math.FloatArrayType;
        inverseMatrix: math.FloatArrayType
    };

    #inverseMatrixDirty: boolean;
    #transposedMatrixDirty: boolean;

    /**
     * @private
     */
    constructor(camera: Camera, cfg: {
        far?: number;
        near?: number;
        top?: number;
        bottom?: number;
        right?: number;
        left?: number;
    } = {}) {

        super(camera, cfg);

        this.camera = camera;

        this.state = {
            matrix: math.mat4(),
            inverseMatrix: math.mat4(),
            transposedMatrix: math.mat4(),
            near: 0.1,
            far: 10000.0,
            left: (cfg.left !== undefined && cfg.left !== null) ? cfg.left : -1.0,
            right: (cfg.right !== undefined && cfg.right !== null) ? cfg.right : 1.0,
            bottom: (cfg.left !== undefined && cfg.bottom !== null) ? cfg.bottom : -1.0,
            top: (cfg.top !== undefined && cfg.top !== null) ? cfg.top : 1.0
        };

        this.#inverseMatrixDirty = true;
        this.#transposedMatrixDirty = true;
    }

    /**
     * Gets the position of the Frustum's left plane on the View-space X-axis.
     *
     * @return {Number} Left frustum plane position.
     */
    get left(): number {
        return this.state.left;
    }

    /**
     * Sets the position of the Frustum's left plane on the View-space X-axis.
     *
     * @param value New left frustum plane position.
     */
    set left(value: number) {
        this.state.left = value;
        this.setDirty();
    }

    /**
     * Gets the position of the Frustum's right plane on the View-space X-axis.
     *
     * @return {Number} Right frustum plane position.
     */
    get right(): number {
        return this.state.right;
    }

    /**
     * Sets the position of the Frustum's right plane on the View-space X-axis.
     *
     * @param value New right frustum plane position.
     */
    set right(value: number) {
        this.state.right = value
        this.setDirty();
    }

    /**
     * Gets the position of the Frustum's top plane on the View-space Y-axis.
     *
     * Fires a {@link Frustum#top:emits} emits on change.
     *
     * @return {Number} Top frustum plane position.
     */
    get top(): number {
        return this.state.top;
    }

    /**
     * Sets the position of the Frustum's top plane on the View-space Y-axis.
     *
     * @param value New top frustum plane position.
     */
    set top(value: number) {
        this.state.top = value
        this.setDirty();
    }

    /**
     * Gets the position of the Frustum's bottom plane on the View-space Y-axis.
     *
     * @return {Number} Bottom frustum plane position.
     */
    get bottom(): number {
        return this.state.bottom;
    }

    /**
     * Sets the position of the Frustum's bottom plane on the View-space Y-axis.
     *
     * @param value New bottom frustum plane position.
     */
    set bottom(value: number) {
        this.state.bottom = value
        this.setDirty();
    }

    /**
     * Gets the position of the Frustum's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @return {Number} Near frustum plane position.
     */
    get near(): number {
        return this.state.near;
    }

    /**
     * Sets the position of the Frustum's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @param value New Frustum near plane position.
     */
    set near(value: number) {
        this.state.near = value
        this.setDirty();
    }

    /**
     * Gets the position of the Frustum's far plane on the positive View-space Z-axis.
     *
     * Default value is ````10000.0````.
     *
     * @return {Number} Far frustum plane position.
     */
    get far(): number {
        return this.state.far;
    }

    /**
     * Sets the position of the Frustum's far plane on the positive View-space Z-axis.
     *
     * Default value is ````10000.0````.
     *
     * @param value New far frustum plane position.
     */
    set far(value: number) {
        this.state.far = value
        this.setDirty();
    }

    /**
     * Gets the Frustum's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @returns The Frustum's projection matrix matrix.
     */
    get matrix(): math.FloatArrayType {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        return this.state.matrix;
    }

    /**
     * Gets the inverse of {@link Frustum#matrix}.
     *
     * @returns  The inverse orthographic projection matrix.
     */
    get inverseMatrix(): math.FloatArrayType  {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        if (this.#inverseMatrixDirty) {
            math.inverseMat4(this.state.matrix, this.state.inverseMatrix);
            this.#inverseMatrixDirty = false;
        }
        return this.state.inverseMatrix;
    }

    /**
     * Gets the transpose of {@link Frustum#matrix}.
     *
     * @returns The transpose of {@link Frustum#matrix}.
     */
    get transposedMatrix(): math.FloatArrayType  {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        if (this.#transposedMatrixDirty) {
            math.transposeMat4(this.state.matrix, this.state.transposedMatrix);
            this.#transposedMatrixDirty = false;
        }
        return this.state.transposedMatrix;
    }

    clean() {
        math.frustumMat4(this.state.left, this.state.right, this.state.bottom, this.state.top, this.state.near, this.state.far, this.state.matrix);
        this.#inverseMatrixDirty = true;
        this.#transposedMatrixDirty = true;
        this.camera.view.redraw();
        this.events.fire("matrix", this.state.matrix);
    }

    /**
     * Un-projects the given Canvas-space coordinates, using this Frustum projection.
     *
     * @param canvasPos Inputs 2D Canvas-space coordinates.
     * @param screenZ Inputs Screen-space Z coordinate.
     * @param screenPos Outputs 3D Screen/Clip-space coordinates.
     * @param viewPos Outputs un-projected 3D View-space coordinates.
     * @param worldPos Outputs un-projected 3D World-space coordinates.
     */
    unproject(
        canvasPos: math.FloatArrayType,
        screenZ: number,
        screenPos: math.FloatArrayType,
        viewPos: math.FloatArrayType,
        worldPos: math.FloatArrayType): math.FloatArrayType {

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

export {Frustum};