import * as math from '../../math/index';
import { Component } from '../../Component';
import type { Camera } from "./Camera";
import { EventEmitter } from "./../../EventEmitter";
/**
 * Perspective projection configuration for a {@link Camera}.
 *
 * ## Summary
 *
 * * Located at {@link Camera.perspective}.
 * * Implicitly sets the left, right, top, bottom frustum planes using {@link Perspective.fov}.
 * * {@link Perspective.near} and {@link Perspective.far} specify the distances to the clipping planes.
 * * {@link Perspective.onProjMatrix} will fire an event whenever {@link Perspective.projMatrix} updates, which indicates that one or more other properties have updated.
 */
declare class Perspective extends Component {
    #private;
    /**
     * The Camera this Perspective belongs to.
     */
    readonly camera: Camera;
    /**
     * Emits an event each time {@link Perspective.projMatrix} updates.
     *
     * @event
     */
    readonly onProjMatrix: EventEmitter<Perspective, math.FloatArrayParam>;
    /**
     * The type of this projection.
     */
    static readonly type: number;
    /**
     * @private
     */
    constructor(camera: Camera, cfg?: {
        fov?: number;
        fovAxis?: string;
        near?: number;
        far?: number;
    });
    /**
     * Gets the Perspective's field-of-view angle (FOV).
     *
     * Default value is ````60.0````.
     *
     * @returns {Number} Current field-of-view.
     */
    get fov(): number;
    /**
     * Sets the Perspective's field-of-view angle (FOV).
     *
     * Default value is ````60.0````.
     *
     * @param value New field-of-view.
     */
    set fov(value: number);
    /**
     * Gets the Perspective's FOV axis.
     *
     * Options are ````"x"````, ````"y"```` or ````"min"````, to use the minimum axis.
     *
     * Default value is ````"min"````.
     *
     * @returns {String} The current FOV axis value.
     */
    get fovAxis(): string;
    /**
     * Sets the Perspective's FOV axis.
     *
     * Options are ````"x"````, ````"y"```` or ````"min"````, to use the minimum axis.
     *
     * Default value ````"min"````.
     *
     * @param value New FOV axis value.
     */
    set fovAxis(value: string);
    /**
     * Gets the position of the Perspective's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @returns The Perspective's near plane position.
     */
    get near(): number;
    /**
     * Sets the position of the Perspective's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @param value New Perspective near plane position.
     */
    set near(value: number);
    /**
     * Gets the position of this Perspective's far plane on the positive View-space Z-axis.
     *
     * @return {Number} The Perspective's far plane position.
     */
    get far(): number;
    /**
     * Sets the position of this Perspective's far plane on the positive View-space Z-axis.
     *
     * @param value New Perspective far plane position.
     */
    set far(value: number);
    /**
     * Gets the Perspective's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @returns  The Perspective's projection matrix.
     */
    get projMatrix(): math.FloatArrayParam;
    /**
     * Gets the inverse of {@link Perspective.projMatrix}.
     *
     * @returns  The inverse of {@link Perspective.projMatrix}.
     */
    get inverseProjMatrix(): math.FloatArrayParam;
    /**
     * Gets the transpose of {@link Perspective.projMatrix}.
     *
     * @returns  The transpose of {@link Perspective.projMatrix}.
     */
    get transposedProjMatrix(): math.FloatArrayParam;
    /**
     * @private
     */
    clean(): void;
    /**
     * Un-projects the given View-space coordinates and Screen-space depth, using this Perspective projection.
     *
     * @param canvasPos Inputs 2D View-space coordinates.
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
export { Perspective };
