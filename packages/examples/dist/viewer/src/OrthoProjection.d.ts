import type { Camera } from "./Camera";
import { Component, EventEmitter } from "@xeokit/core";
import type { FloatArrayParam } from "@xeokit/math";
/**
 * Orthographic projection configuration for a {@link @xeokit/viewer!Camera} .
 *
 * * Located at {@link @xeokit/viewer!Camera.orthoProjection | Camera.orthoProjection}.
 * * Works like Blender's orthographic projection, where the positions of the left, right, top and bottom planes are implicitly
 * indicated with a single {@link @xeokit/viewer!OrthoProjection.scale | OrthoProjection.scale} property, which causes the frustum to be symmetrical on X and Y axis, large enough to
 * contain the number of units given by {@link @xeokit/viewer!OrthoProjection.scale | OrthoProjection.scale}.
 * * {@link @xeokit/viewer!OrthoProjection.near | OrthoProjection.near} and {@link @xeokit/viewer!OrthoProjection.far | OrthoProjection.far} indicated the distances to the clipping planes.
 * * {@link @xeokit/viewer!OrthoProjection.onProjMatrix | OrthoProjection.onProjMatrix} will fire an event whenever {@link @xeokit/viewer!OrthoProjection.projMatrix | OrthoProjection.projMatrix} updates, which indicates that one or more other properties have updated.
 */
export declare class OrthoProjection extends Component {
    #private;
    /**
     * The Camera this OrthoProjection belongs to.
     */
    readonly camera: Camera;
    /**
     * Emits an event each time {@link @xeokit/viewer!OrthoProjection.projMatrix | OrthoProjection.projMatrix} updates.
     *
     * @event
     */
    readonly onProjMatrix: EventEmitter<OrthoProjection, FloatArrayParam>;
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
     * Gets scale factor for this OrthoProjection's extents on X and Y axis.
     *
     * Clamps to minimum value of ````0.01```.
     *
     * Default value is ````1.0````
     *
     * returns New OrthoProjection scale value.
     */
    get scale(): number;
    /**
     * Sets scale factor for this OrthoProjection's extents on X and Y axis.
     *
     * Clamps to minimum value of ````0.01```.
     *
     * Default value is ````1.0````
     * @param value New scale value.
     */
    set scale(value: number);
    /**
     * Gets the position of the OrthoProjection's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * returns New OrthoProjection near plane position.
     */
    get near(): number;
    /**
     * Sets the position of the OrthoProjection's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @param value New OrthoProjection near plane position.
     */
    set near(value: number);
    /**
     * Gets the position of the OrthoProjection's far plane on the positive View-space Z-axis.
     *
     * Default value is ````10000.0````.
     *
     * returns New far ortho plane position.
     */
    get far(): number;
    /**
     * Sets the position of the OrthoProjection's far plane on the positive View-space Z-axis.
     *
     * Default value is ````2000.0````.
     *
     * @param value New far ortho plane position.
     */
    set far(value: number);
    /**
     * Gets the OrthoProjection's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @returns  The OrthoProjection's projection matrix.
     */
    get projMatrix(): FloatArrayParam;
    /**
     * Gets the inverse of {@link @xeokit/viewer!OrthoProjection.projMatrix | OrthoProjection.projMatrix}.
     *
     * @returns  The inverse of {@link @xeokit/viewer!OrthoProjection.projMatrix | OrthoProjection.projMatrix}.
     */
    get inverseProjMatrix(): FloatArrayParam;
    /**
     * Gets the transpose of {@link @xeokit/viewer!OrthoProjection.projMatrix | OrthoProjection.projMatrix}.
     *
     * @returns  The transpose of {@link @xeokit/viewer!OrthoProjection.projMatrix | OrthoProjection.projMatrix}.
     */
    get transposedProjMatrix(): FloatArrayParam;
    /**
     * @private
     */
    clean(): void;
    /**
     * Un-projects the given View-space coordinates, using this OrthoProjection projection.
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
