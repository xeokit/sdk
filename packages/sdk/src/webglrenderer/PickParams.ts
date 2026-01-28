import type {Mat4} from "../math/matrix";
import type { Vec3, Vec2} from "../math/vector";

/**
 * TODO
 */
export interface PickParams {

  /**
   * Whether to snap to the nearest vertex to {@link PickParams.canvasPos}.
   */
  snapToVertex?: boolean;

  /**
   * Whether to snap to the nearest edge to {@link PickParams.canvasPos}.
   */
  snapToEdge?: boolean;

  /**
   * The snap radius around {@link PickParams.canvasPos}, in canvas pixels.
   */
  snapRadius?: number;

  /**
   * Set this ````true```` to perform a ray-pick; leave ````false```` to pick at canvas coordinates.
   */
  rayPick?: boolean;

  /**
   * Set this ````true```` to pick a {@link ViewObject | ViewObjects}.
   */
  pickViewObject?: boolean;

  /**
   * Set this ````true```` to pick a 3D position on a surface.
   */
  pickSurface?: boolean;

  /**
   * Set this ````false```` to not pick invisible {@link ViewObject | ViewObjects}. Default is ````true````.
   */
  pickInvisible?: boolean;

  /**
   * Set this ````true```` when ray-picking to pick the normal vector on the surface of the picked object.
   */
  pickSurfaceNormal?: boolean;

  /**
   * Canvas coordinates, used when {@link PickParams.rayPick} is ````false````.
   */
  canvasPos?: Vec2;

  /**
   * Ray-picking origin, used when {@link PickParams.rayPick} is ````true````.
   */
  rayOrigin?: Vec3;

  /**
   * Ray-picking direction, used when {@link PickParams.rayPick} is ````true````.
   */
  rayDirection?: Vec3;

  /**
   * Ray-picking direction matrix, used when {@link PickParams.rayPick} is ````true````.
   */
  rayMatrix?: Mat4;
}
