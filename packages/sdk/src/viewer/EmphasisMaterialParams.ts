import {Vec3Float} from "../math";

/**
 * Parameters for a View's selected, highlighted and x-ray effects.
 *
 * * Returned by {@link EmphasisMaterial.toParams | EmphasisMaterial.toParams}
 * * Passed to {@link EmphasisMaterial.fromParams | EmphasisMaterial.fromParams}
 * * Located at {@link ViewParams.highlightMaterial | ViewParams.highlightMaterial}, {@link ViewParams.selectedMaterial | ViewParams.selectedMaterial} and {@link ViewParams.xrayMaterial | ViewParams.xrayMaterial}
 */
export interface EmphasisMaterialParams {

  /**
   * The RGB color of {@link EmphasisMaterial | EmphasisMaterial} edges.
   *
   * Default is ```` [0.2, 0.2, 0.2]````.
   */
  edgeColor?: Vec3Float;

  /**
   * Pixel width of {@link EmphasisMaterial | EmphasisMaterial} edges.
   *
   * Default is ````1````.
   */
  edgeWidth?: number;

  /**
   * Opacity of {@link EmphasisMaterial | EmphasisMaterial} edges.
   *
   * Value is in range ````[0..1]````.
   *
   * Default is ````1````.
   */
  edgeAlpha?: number;

  /**
   * Whether {@link EmphasisMaterial | EmphasisMaterial} edges are visible.
   *
   * Default is ````true````.
   */
  edges?: boolean;

  /**
   * The RGB color of {@link EmphasisMaterial | EmphasisMaterial} surfaces.
   *
   * Default is ```` [1.0, 1.0, 1.0]````.
   */
  fillColor?: Vec3Float;

  /**
   * Whether {@link EmphasisMaterial | EmphasisMaterial} backfaces are visible.
   *
   * Default is ````false````.
   */
  backfaces?: boolean;

  /**
   * Opacity of {@link EmphasisMaterial | EmphasisMaterial} surfaces.
   *
   * Value is in range ````[0..1]````.
   *
   * Default is ````1````.
   */
  fillAlpha?: number;

  /**
   * Whether {@link EmphasisMaterial | EmphasisMaterial} surfaces are filled.
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
