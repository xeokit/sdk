import type {Mat4} from "../math/matrix";
import type {Vec2, Vec3} from "../math/vector";

/**
 * Defines a projection for a {@link Camera | Camera}.
 */
export interface Projection {

  /**
   * The type of this projection.
   */
  readonly projMatrix: Mat4;

  /**
   * The inverse of the projection matrix.
   */
  readonly inverseProjMatrix: Mat4;

  /**
   * The transposed projection matrix.
   */
  readonly transposedProjMatrix: Mat4;

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
    canvasPos: Vec2,
    screenZ: number,
    screenPos: Vec3,
    viewPos: Vec3,
    worldPos: Vec3): Vec3;
}
