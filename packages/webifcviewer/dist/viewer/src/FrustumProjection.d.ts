import type { Camera } from "./Camera";
import { Component, EventEmitter } from "@xeokit/core";
import type { FloatArrayParam } from "@xeokit/math";
/**
 *  FrustumProjection-based perspective projection configuration for a {@link @xeokit/viewer!Camera} .
 *
 * * Located at {@link Camera.frustumProjection}.
 * * Allows to explicitly set the positions of the left, right, top, bottom, near and far planes, which is useful for asymmetrical view volumes, such as for stereo viewing.
 * * {@link FrustumProjection.near} and {@link FrustumProjection.far} specify the distances to the clipping planes.
 * * {@link FrustumProjection.onProjMatrix} will fire an event whenever {@link FrustumProjection.projMatrix} updates, which indicates that one or more other properties have updated.
 */
export declare class FrustumProjection extends Component {
    #private;
    /**
     * The type of this projection.
     */
    static readonly type: number;
    /**
     * The Camera this FrustumProjection belongs to.
     */
    readonly camera: Camera;
    /**
     * Emits an event each time {@link FrustumProjection.projMatrix} updates.
     *
     * @event
     */
    readonly onProjMatrix: EventEmitter<FrustumProjection, FloatArrayParam>;
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
     * Gets the position of the FrustumProjection's left plane on the View-space X-axis.
     *
     * @return {Number} Left frustum plane position.
     */
    get left(): number;
    /**
     * Sets the position of the FrustumProjection's left plane on the View-space X-axis.
     *
     * @param value New left frustum plane position.
     */
    set left(value: number);
    /**
     * Gets the position of the FrustumProjection's right plane on the View-space X-axis.
     *
     * @return {Number} Right frustum plane position.
     */
    get right(): number;
    /**
     * Sets the position of the FrustumProjection's right plane on the View-space X-axis.
     *
     * @param value New right frustum plane position.
     */
    set right(value: number);
    /**
     * Gets the position of the FrustumProjection's top plane on the View-space Y-axis.
     *
     * @return {Number} Top frustum plane position.
     */
    get top(): number;
    /**
     * Sets the position of the FrustumProjection's top plane on the View-space Y-axis.
     *
     * @param value New top frustum plane position.
     */
    set top(value: number);
    /**
     * Gets the position of the FrustumProjection's bottom plane on the View-space Y-axis.
     *
     * @return {Number} Bottom frustum plane position.
     */
    get bottom(): number;
    /**
     * Sets the position of the FrustumProjection's bottom plane on the View-space Y-axis.
     *
     * @param value New bottom frustum plane position.
     */
    set bottom(value: number);
    /**
     * Gets the position of the FrustumProjection's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @return {Number} Near frustum plane position.
     */
    get near(): number;
    /**
     * Sets the position of the FrustumProjection's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @param value New FrustumProjection near plane position.
     */
    set near(value: number);
    /**
     * Gets the position of the FrustumProjection's far plane on the positive View-space Z-axis.
     *
     * Default value is ````10000.0````.
     *
     * @return {Number} Far frustum plane position.
     */
    get far(): number;
    /**
     * Sets the position of the FrustumProjection's far plane on the positive View-space Z-axis.
     *
     * Default value is ````10000.0````.
     *
     * @param value New far frustum plane position.
     */
    set far(value: number);
    /**
     * Gets the FrustumProjection's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @returns The FrustumProjection's projection matrix
     */
    get projMatrix(): FloatArrayParam;
    /**
     * Gets the inverse of {@link FrustumProjection.projMatrix}.
     *
     * @returns  The inverse orthographic projection projMatrix.
     */
    get inverseProjMatrix(): FloatArrayParam;
    /**
     * Gets the transpose of {@link FrustumProjection.projMatrix}.
     *
     * @returns The transpose of {@link FrustumProjection.projMatrix}.
     */
    get transposedProjMatrix(): FloatArrayParam;
    /**
     * @private
     */
    clean(): void;
    /**
     * Un-projects the given View-space coordinates, using this FrustumProjection projection.
     *
     * @param canvasPos Inputs 2D View-space coordinates.
     * @param screenZ Inputs Screen-space Z coordinate.
     * @param screenPos Outputs 3D Screen/Clip-space coordinates.
     * @param viewPos Outputs un-projected 3D View-space coordinates.
     * @param worldPos Outputs un-projected 3D World-space coordinates.
     */
    unproject(canvasPos: FloatArrayParam, screenZ: number, screenPos: FloatArrayParam, viewPos: FloatArrayParam, worldPos: FloatArrayParam): FloatArrayParam;
    /** @private
     *
     */
    destroy(): void;
}
