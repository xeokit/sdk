import {FloatArrayParam} from "@xeokit/math";

/**
 *
 */
export interface Projection {

    readonly projMatrix: FloatArrayParam;

    readonly inverseProjMatrix: FloatArrayParam;

    readonly transposedProjMatrix: FloatArrayParam;

    /**
     * Un-projects the given View-space coordinates, using this OrthoProjection projection.
     *
     * @param canvasPos Inputs 2D View-space coordinates.
     * @param screenZ Inputs Screen-space Z coordinate.
     * @param screenPos Outputs 3D Screen/Clip-space coordinates.
     * @param viewPos Outputs un-projected 3D View-space coordinates.
     * @param worldPos Outputs un-projected 3D World-space coordinates.
     */
    unproject(
        canvasPos: FloatArrayParam,
        screenZ: number,
        screenPos: FloatArrayParam,
        viewPos: FloatArrayParam,
        worldPos: FloatArrayParam): FloatArrayParam;
}
