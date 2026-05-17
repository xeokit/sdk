import type {Vec3} from "../../base/math/vector";

/**
 * Parameters for a View's selected, highlighted and x-ray effects.
 *
 * * Returned by {@link Effect.toParams | Effect.toParams}
 * * Passed to {@link Effect.fromParams | Effect.fromParams}
 * * Located at {@link ViewParams.highlightMaterial | ViewParams.highlightMaterial}, {@link ViewParams.selectedMaterial | ViewParams.selectedMaterial} and {@link ViewParams.xrayMaterial | ViewParams.xrayMaterial}
 */
export interface EffectParams {

  /**
   * The RGB color of {@link Effect | Effect} edges.
   *
   * Default is ```` [0.2, 0.2, 0.2]````.
   */
  edgeColor?: Vec3;

  /**
   * Pixel width of {@link Effect | Effect} edges.
   *
   * Default is ````1````.
   */
  edgeWidth?: number;

  /**
   * Opacity of {@link Effect | Effect} edges.
   *
   * Value is in range ````[0..1]````.
   *
   * Default is ````1````.
   */
  edgeAlpha?: number;

  /**
   * Whether {@link Effect | Effect} edges are visible.
   *
   * Default is ````true````.
   */
  edges?: boolean;

  /**
   * The RGB color of {@link Effect | Effect} surfaces.
   *
   * Default is ```` [1.0, 1.0, 1.0]````.
   */
  fillColor?: Vec3;

  /**
   * Whether {@link Effect | Effect} backfaces are visible.
   *
   * Default is ````false````.
   */
  backfaces?: boolean;

  /**
   * Opacity of {@link Effect | Effect} surfaces.
   *
   * Value is in range ````[0..1]````.
   *
   * Default is ````1````.
   */
  fillAlpha?: number;

  /**
   * Whether {@link Effect | Effect} surfaces are filled.
   *
   * Default is ````true````.
   */
  fill?: boolean;

  /**
   * Sets whether to render emphasized objects over the top of other objects, as if they were "glowing through".
   *
   * Default is ````true````.
   *
   * Note: updating this property will not affect the appearance of objects that are already emphasized.
   *
   * @type {Boolean}
   */
  glowThrough?: boolean;
}
