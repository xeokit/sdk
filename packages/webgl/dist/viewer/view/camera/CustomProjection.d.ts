import * as math from '../../math/index';
import { Component } from '../../Component';
import type { Camera } from "./Camera";
import { EventEmitter } from "./../../EventEmitter";
/**
 * Configures a custom projection for a {@link Camera}.
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
    readonly onProjMatrix: EventEmitter<CustomProjection, math.FloatArrayParam>;
    /**
     * The type of this projection.
     */
    static readonly type: number;
    /**
     * @private
     */
    constructor(camera: Camera, cfg?: {
        projMatrix?: math.FloatArrayParam;
    });
    /**
     * Gets the CustomProjection's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @return  New value for the CustomProjection's matrix.
     */
    get projMatrix(): math.FloatArrayParam;
    /**
     * Sets the CustomProjection's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @param projMatrix New value for the CustomProjection's matrix.
     */
    set projMatrix(projMatrix: math.FloatArrayParam);
    /**
     * Gets the inverse of {@link CustomProjection.projMatrix}.
     *
     * @returns The inverse of {@link CustomProjection.projMatrix}.
     */
    get inverseProjMatrix(): math.FloatArrayParam;
    /**
     * Gets the transpose of {@link CustomProjection.projMatrix}.
     *
     * @returns The transpose of {@link CustomProjection.projMatrix}.
     */
    get transposedProjMatrix(): math.FloatArrayParam;
    /**
     * Un-projects the given Canvas-space coordinates, using this CustomProjection.
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
export { CustomProjection };
