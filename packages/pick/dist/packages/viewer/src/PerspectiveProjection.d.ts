import type { Camera } from "./Camera";
import { Component, EventEmitter } from "@xeokit/core";
import type { FloatArrayParam } from "@xeokit/math";
/**
 * PerspectiveProjection projection configuration for a {@link @xeokit/viewer!Camera} .
 *
 * ## Summary
 *
 * * Located at {@link Camera.perspectiveProjection}.
 * * Implicitly sets the left, right, top, bottom frustum planes using {@link PerspectiveProjection.fov}.
 * * {@link PerspectiveProjection.near} and {@link PerspectiveProjection.far} specify the distances to the clipping planes.
 * * {@link PerspectiveProjection.onProjMatrix} will fire an event whenever {@link PerspectiveProjection.projMatrix} updates, which indicates that one or more other properties have updated.
 */
export declare class PerspectiveProjection extends Component {
    #private;
    /**
     * The Camera this PerspectiveProjection belongs to.
     */
    readonly camera: Camera;
    /**
     * Emits an event each time {@link PerspectiveProjection.projMatrix} updates.
     *
     * @event
     */
    readonly onProjMatrix: EventEmitter<PerspectiveProjection, FloatArrayParam>;
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
     * Gets the PerspectiveProjection's field-of-view angle (FOV).
     *
     * Default value is ````60.0````.
     *
     * @returns {Number} Current field-of-view.
     */
    get fov(): number;
    /**
     * Sets the PerspectiveProjection's field-of-view angle (FOV).
     *
     * Default value is ````60.0````.
     *
     * @param value New field-of-view.
     */
    set fov(value: number);
    /**
     * Gets the PerspectiveProjection's FOV axis.
     *
     * Options are ````"x"````, ````"y"```` or ````"min"````, to use the minimum axis.
     *
     * Default value is ````"min"````.
     *
     * @returns {String} The current FOV axis value.
     */
    get fovAxis(): string;
    /**
     * Sets the PerspectiveProjection's FOV axis.
     *
     * Options are ````"x"````, ````"y"```` or ````"min"````, to use the minimum axis.
     *
     * Default value ````"min"````.
     *
     * @param value New FOV axis value.
     */
    set fovAxis(value: string);
    /**
     * Gets the position of the PerspectiveProjection's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @returns The PerspectiveProjection's near plane position.
     */
    get near(): number;
    /**
     * Sets the position of the PerspectiveProjection's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @param value New PerspectiveProjection near plane position.
     */
    set near(value: number);
    /**
     * Gets the position of this PerspectiveProjection's far plane on the positive View-space Z-axis.
     *
     * @return {Number} The PerspectiveProjection's far plane position.
     */
    get far(): number;
    /**
     * Sets the position of this PerspectiveProjection's far plane on the positive View-space Z-axis.
     *
     * @param value New PerspectiveProjection far plane position.
     */
    set far(value: number);
    /**
     * Gets the PerspectiveProjection's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @returns  The PerspectiveProjection's projection matrix.
     */
    get projMatrix(): FloatArrayParam;
    /**
     * Gets the inverse of {@link PerspectiveProjection.projMatrix}.
     *
     * @returns  The inverse of {@link PerspectiveProjection.projMatrix}.
     */
    get inverseProjMatrix(): FloatArrayParam;
    /**
     * Gets the transpose of {@link PerspectiveProjection.projMatrix}.
     *
     * @returns  The transpose of {@link PerspectiveProjection.projMatrix}.
     */
    get transposedProjMatrix(): FloatArrayParam;
    /**
     * @private
     */
    clean(): void;
    /**
     * Un-projects the given View-space coordinates and Screen-space depth, using this PerspectiveProjection projection.
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
