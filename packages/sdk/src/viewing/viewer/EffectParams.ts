import type {Vec3} from "../../base/math/vector";

/**
 * Parameters for a {@link ViewStyleBin | ViewStyleBin} material.
 *
 * * Returned by {@link Effect.toParams | Effect.toParams}
 * * Passed to {@link Effect.fromParams | Effect.fromParams}
 * * Located at {@link ViewStyleBinParams.material | ViewStyleBinParams.material} and {@link ViewParams.styleBins | ViewParams.styleBins}
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
   * Sets whether to clear the depth buffer before rendering this style bin.
   *
   * When ````true````, objects in this style bin are also rendered in a
   * depth-cleared style-bin pass, making the bin treatment visible through
   * occluding geometry while leaving the object's normal rendering treatment
   * intact.
   *
   * Default is ````false````.
   *
   * Note: updating this property marks the View dirty but does not change membership.
   *
   * @type {Boolean}
   */
  clearDepthBefore?: boolean;
}
