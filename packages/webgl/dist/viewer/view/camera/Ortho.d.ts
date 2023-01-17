import { Component } from '../../Component';
import type { Camera } from "./Camera";
import * as math from '../../math/index';
import { EventEmitter } from "../../EventEmitter";
/**
 * Orthographic projection configuration for a {@link Camera}.
 *
 * * Located at {@link Camera.ortho}.
 * * Works like Blender's orthographic projection, where the positions of the left, right, top and bottom planes are implicitly
 * indicated with a single {@link Ortho.scale} property, which causes the frustum to be symmetrical on X and Y axis, large enough to
 * contain the number of units given by {@link Ortho.scale}.
 * * {@link Ortho.near} and {@link Ortho.far} indicated the distances to the clipping planes.
 * * {@link Ortho.onProjMatrix} will fire an event whenever {@link Ortho.projMatrix} updates, which indicates that one or more other properties have updated.
 */
declare class Ortho extends Component {
    #private;
    /**
     * The Camera this Ortho belongs to.
     */
    readonly camera: Camera;
    /**
     * Emits an event each time {@link Ortho.projMatrix} updates.
     *
     * @event
     */
    readonly onProjMatrix: EventEmitter<Ortho, math.FloatArrayParam>;
    /**
     * The type of this projection.
     */
    static readonly type: number;
    /**
     * @private
     */
    constructor(camera: Camera, cfg?: {
        far?: number;
        near?: number;
        scale?: number;
    });
    /**
     * Gets scale factor for this Ortho's extents on X and Y axis.
     *
     * Clamps to minimum value of ````0.01```.
     *
     * Default value is ````1.0````
     *
     * returns New Ortho scale value.
     */
    get scale(): number;
    /**
     * Sets scale factor for this Ortho's extents on X and Y axis.
     *
     * Clamps to minimum value of ````0.01```.
     *
     * Default value is ````1.0````
     * @param value New scale value.
     */
    set scale(value: number);
    /**
     * Gets the position of the Ortho's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * returns New Ortho near plane position.
     */
    get near(): number;
    /**
     * Sets the position of the Ortho's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @param value New Ortho near plane position.
     */
    set near(value: number);
    /**
     * Gets the position of the Ortho's far plane on the positive View-space Z-axis.
     *
     * Default value is ````10000.0````.
     *
     * returns New far ortho plane position.
     */
    get far(): number;
    /**
     * Sets the position of the Ortho's far plane on the positive View-space Z-axis.
     *
     * Default value is ````2000.0````.
     *
     * @param value New far ortho plane position.
     */
    set far(value: number);
    /**
     * Gets the Ortho's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @returns  The Ortho's projection matrix.
     */
    get projMatrix(): math.FloatArrayParam;
    /**
     * Gets the inverse of {@link Ortho.projMatrix}.
     *
     * @returns  The inverse of {@link Ortho.projMatrix}.
     */
    get inverseProjMatrix(): math.FloatArrayParam;
    /**
     * Gets the transpose of {@link Ortho.projMatrix}.
     *
     * @returns  The transpose of {@link Ortho.projMatrix}.
     */
    get transposedProjMatrix(): math.FloatArrayParam;
    /**
     * @private
     */
    clean(): void;
    /**
     * Un-projects the given Canvas-space coordinates, using this Ortho projection.
     *
     * @param canvasPos Inputs 2D Canvas-space coordinates.
     * @param screenZ Inputs Screen-space Z coordinate.
     * @param screenPos Outputs 3D Screen/Clip-space coordinates.
     * @param viewPos Outputs un-projected 3D View-space coordinates.
     * @param worldPos Outputs un-projected 3D World-space coordinates.
     */
    unproject(canvasPos: math.FloatArrayParam, screenZ: number, screenPos: math.FloatArrayParam, viewPos: math.FloatArrayParam, worldPos: math.FloatArrayParam): math.FloatArrayParam;
    /** @private
     *
     */
    destroy(): void;
}
export { Ortho };
