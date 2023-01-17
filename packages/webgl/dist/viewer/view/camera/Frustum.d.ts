import { Component } from '../../Component';
import type { Camera } from "./Camera";
import * as math from '../../math/index';
import { EventEmitter } from "../../EventEmitter";
/**
 *  Frustum-based perspective projection configuration for a {@link Camera}.
 *
 * * Located at {@link Camera#frustum}.
 * * Allows to explicitly set the positions of the left, right, top, bottom, near and far planes, which is useful for asymmetrical view volumes, such as for stereo viewing.
 * * {@link Frustum#near} and {@link Frustum#far} specify the distances to the clipping planes.
 * * {@link Frustum.onProjMatrix} will fire an event whenever {@link Frustum.projMatrix} updates, which indicates that one or more other properties have updated.
 */
declare class Frustum extends Component {
    #private;
    /**
     * The Camera this Frustum belongs to.
     */
    readonly camera: Camera;
    /**
     * Emits an event each time {@link Frustum.projMatrix} updates.
     *
     * @event
     */
    readonly onProjMatrix: EventEmitter<Frustum, math.FloatArrayParam>;
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
        top?: number;
        bottom?: number;
        right?: number;
        left?: number;
    });
    /**
     * Gets the position of the Frustum's left plane on the View-space X-axis.
     *
     * @return {Number} Left frustum plane position.
     */
    get left(): number;
    /**
     * Sets the position of the Frustum's left plane on the View-space X-axis.
     *
     * @param value New left frustum plane position.
     */
    set left(value: number);
    /**
     * Gets the position of the Frustum's right plane on the View-space X-axis.
     *
     * @return {Number} Right frustum plane position.
     */
    get right(): number;
    /**
     * Sets the position of the Frustum's right plane on the View-space X-axis.
     *
     * @param value New right frustum plane position.
     */
    set right(value: number);
    /**
     * Gets the position of the Frustum's top plane on the View-space Y-axis.
     *
     * @return {Number} Top frustum plane position.
     */
    get top(): number;
    /**
     * Sets the position of the Frustum's top plane on the View-space Y-axis.
     *
     * @param value New top frustum plane position.
     */
    set top(value: number);
    /**
     * Gets the position of the Frustum's bottom plane on the View-space Y-axis.
     *
     * @return {Number} Bottom frustum plane position.
     */
    get bottom(): number;
    /**
     * Sets the position of the Frustum's bottom plane on the View-space Y-axis.
     *
     * @param value New bottom frustum plane position.
     */
    set bottom(value: number);
    /**
     * Gets the position of the Frustum's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @return {Number} Near frustum plane position.
     */
    get near(): number;
    /**
     * Sets the position of the Frustum's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @param value New Frustum near plane position.
     */
    set near(value: number);
    /**
     * Gets the position of the Frustum's far plane on the positive View-space Z-axis.
     *
     * Default value is ````10000.0````.
     *
     * @return {Number} Far frustum plane position.
     */
    get far(): number;
    /**
     * Sets the position of the Frustum's far plane on the positive View-space Z-axis.
     *
     * Default value is ````10000.0````.
     *
     * @param value New far frustum plane position.
     */
    set far(value: number);
    /**
     * Gets the Frustum's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @returns The Frustum's projection matrix
     */
    get projMatrix(): math.FloatArrayParam;
    /**
     * Gets the inverse of {@link Frustum.projMatrix}.
     *
     * @returns  The inverse orthographic projection projMatrix.
     */
    get inverseProjMatrix(): math.FloatArrayParam;
    /**
     * Gets the transpose of {@link Frustum.projMatrix}.
     *
     * @returns The transpose of {@link Frustum.projMatrix}.
     */
    get transposedProjMatrix(): math.FloatArrayParam;
    /**
     * @private
     */
    clean(): void;
    /**
     * Un-projects the given Canvas-space coordinates, using this Frustum projection.
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
export { Frustum };
