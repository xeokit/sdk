import type {FloatArrayParam} from "../math";

/**
 * Parameters for a View's edge enhancement effect, {@link Edges}.
 *
 * * Returned by {@link Edges.toParams | Edges.toParams}
 * * Passed to {@link Edges.fromParams | Edges.fromParams}
 * * Located at {@link ViewParams.edges | ViewParams.edges}
 */
export interface EdgesParams {

  /**
   * RGB edge color for {@link Edges | Edges}.
   *
   * Default value is ````[0.2, 0.2, 0.2]````.
   */
  edgeColor?: FloatArrayParam;

  /**
   * Line width for {@link Edges | Edges}.
   *
   * Default value is ````1.0```` pixels.
   */
  edgeWidth?: number;

  /**
   * Edge transparency for {@link Edges | Edges}.
   *
   * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
   *
   * Default value is ````1.0````.
   */
  edgeAlpha?: number;

  /**
   * Which rendering modes in which to render edges.
   *
   * Default value is [{@link constants!QualityRender | QualityRender}].
   */
  renderModes?: number[];
}
