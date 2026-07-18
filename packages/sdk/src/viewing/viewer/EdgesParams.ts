import type {Vec3} from "../../base/math/vector";

/**
 * Parameters for a View's edge enhancement effect, {@link Edges}.
 *
 * * Returned by {@link Edges.toParams | Edges.toParams}
 * * Passed to {@link Edges.fromParams | Edges.fromParams}
 * * Located at {@link EffectsParams.edges}
 */
export interface EdgesParams {

  /**
   * RGB edge color for {@link Edges | Edges}.
   *
   * Used unless {@link EdgesParams.useMeshColor | useMeshColor} is set.
   *
   * Default value is ````[0.2, 0.2, 0.2]````.
   */
  edgeColor?: Vec3;

  /**
   * When `true`, the base edges effect colours each edge with its own mesh's
   * colour darkened by {@link EdgesParams.edgeDarken | edgeDarken}, instead of
   * the fixed {@link EdgesParams.edgeColor | edgeColor} — so edges read as a
   * shaded outline of each object rather than one uniform colour.
   *
   * Only affects the base edges effect — x-ray / highlight / selected edges
   * always use their emphasis material's colour.
   *
   * Default value is ````true````.
   */
  useMeshColor?: boolean;

  /**
   * Multiplier applied to each mesh's colour when
   * {@link EdgesParams.useMeshColor | useMeshColor} is `true`.
   *
   * `0` yields black edges, `1` leaves the mesh colour unchanged. Range
   * `[0, 1]`.
   *
   * Default value is ````0.5````.
   */
  edgeDarken?: number;

  /**
   * Line width for {@link Edges | Edges}.
   *
   * Default value is ````2.0```` pixels.
   */
  edgeWidth?: number;

  /**
   * Edge transparency for {@link Edges | Edges}.
   *
   * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
   *
   * Default value is ````0.8````.
   */
  edgeAlpha?: number;

  /**
   * Which rendering modes in which to render edges.
   *
   * Default value is [{@link base!constants.DetailedRender | DetailedRender},
   * {@link base!constants.RealisticRender | RealisticRender}].
   */
  renderModes?: number[];

  /**
   * Distance (as a fraction of the active camera's far plane) at which edge
   * fade-out begins. Edges closer than this remain at full intensity.
   *
   * Combined with {@link EdgesParams.edgeFadeEnd | edgeFadeEnd} to produce a
   * smooth alpha falloff that prevents edge density from clumping into a dark
   * mass at long range — most visible in x-ray and silhouette modes.
   *
   * Effective range is `[0, 1]`. Set this `>= edgeFadeEnd` to disable the
   * fade and keep the previous distance-independent appearance.
   *
   * Default value is `0.4`.
   */
  edgeFadeStart?: number;

  /**
   * Distance (as a fraction of the active camera's far plane) at which edges
   * are fully transparent.
   *
   * Combined with {@link EdgesParams.edgeFadeStart | edgeFadeStart} to
   * produce the smooth falloff. Effective range is `[0, 1]`.
   *
   * Default value is `1.0`.
   */
  edgeFadeEnd?: number;
}
