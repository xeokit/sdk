import type {SceneMesh} from "../../model/scene";


/** Parameters for {@link paintHeatMapPoint}. */
export interface PaintHeatMapPointParams {
  /** SceneMesh whose heat-map texture should be updated. */
  sceneMesh: SceneMesh;

  /** World-space 3D point. Length-3 array of (x, y, z). */
  worldPos: ArrayLike<number>;

  /** sRGB brush colour, components in `[0, 1]`. */
  color: [number, number, number];

  /** Brush radius in texels. Default `4`. */
  radius?: number;

  /** Brush alpha at the centre, `[0, 1]`. Default `1`. */
  opacity?: number;

  /**
   * Falloff exponent applied to the radial weight `(1 - r/radius)`.
   *   - `0` — hard-edged disc (every pixel inside the radius gets
   *     full opacity).
   *   - `1` — linear falloff to zero at the edge.
   *   - `>1` — softer, with most of the weight near the centre.
   * Default `1`.
   */
  falloff?: number;

  /**
   * Override world-up axis. Defaults to the SceneModel's
   * `coordinateSystem.worldUp` — which must match what the painter
   * used, otherwise the projection axes won't agree and the brush
   * will land in the wrong place. Use this only if you painted with
   * an explicit `worldUp` override.
   */
  worldUp?: ArrayLike<number>;
}
