import {type FloatArrayParam} from "../math";

/**
 * Defines a projection for a {@link Camera | Camera}.
 */
export interface Projection {

  /**
   * The type of this projection.
   */
  readonly projMatrix: FloatArrayParam;

  /**
   * The inverse of the projection matrix.
   */
  readonly inverseProjMatrix: FloatArrayParam;

  /**
   * The transposed projection matrix.
   */
  readonly transposedProjMatrix: FloatArrayParam;

  /**
   * Un-projects 2D View-space coordinates to 3D Screen/Clip-space, View-space, and World-space coordinates.
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
