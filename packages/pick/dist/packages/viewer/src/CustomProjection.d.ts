import type { Camera } from "./Camera";
import { Component, EventEmitter } from "@xeokit/core";
import type { FloatArrayParam } from "@xeokit/math";
/**
 * Configures a custom projection for a {@link @xeokit/viewer!Camera} .
 *
 * * Located at {@link Camera.customProjection}.
 * * {@link CustomProjection.onProjMatrix} will fire an event whenever {@link CustomProjection.projMatrix} updates, which indicates that one or more other properties have updated.
 */
declare class CustomProjection extends Component {
    #private;
    /**
     * The Camera this CustomProjection belongs to.
     */
    readonly camera: Camera;
    /**
     * Emits an event each time {@link CustomProjection.projMatrix} updates.
     *
     * @event
     */
    readonly onProjMatrix: EventEmitter<CustomProjection, FloatArrayParam>;
    /**
     * The type of this projection.
     */
    static readonly type: number;
    /**
     * @private
     */
    constructor(camera: Camera, cfg?: {
        projMatrix?: FloatArrayParam;
    });
    /**
     * Gets the CustomProjection's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @return  New value for the CustomProjection's matrix.
     */
    get projMatrix(): FloatArrayParam;
    /**
     * Sets the CustomProjection's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @param projMatrix New value for the CustomProjection's matrix.
     */
    set projMatrix(projMatrix: FloatArrayParam);
    /**
     * Gets the inverse of {@link CustomProjection.projMatrix}.
     *
     * @returns The inverse of {@link CustomProjection.projMatrix}.
     */
    get inverseProjMatrix(): FloatArrayParam;
    /**
     * Gets the transpose of {@link CustomProjection.projMatrix}.
     *
     * @returns The transpose of {@link CustomProjection.projMatrix}.
     */
    get transposedProjMatrix(): FloatArrayParam;
    /**
     * Un-projects the given View-space coordinates, using this CustomProjection.
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
export { CustomProjection };
