/**
 * Parameters for a {@link PointsMaterial}.
 *
 * * Returned by {@link PointsMaterial.toParams | PointsMaterial.toParams}
 * * Passed to {@link PointsMaterial.fromParams | PointsMaterial.fromParams}
 * * Located at {@link ViewParams.pointsMaterial | ViewParams.pointsMaterial}
 */
export interface PointsMaterialParams {

  /**
   * The point size of the {@link PointsMaterial}.
   *
   * Default value is ````2.0```` pixels.
   */
  pointSize?: number,

  /**
   * Whether the {@link PointsMaterial} points are round or square.
   *
   * Default is ````true```` to set points round.
   */
  roundPoints?: boolean,

  /**
   * Whether the {@link PointsMaterial} point size reduces with distance when {@link Camera.projection} is set
   * to {@link base!constants.PerspectiveProjectionType | PerspectiveProjectionType}.
   *
   * Default is ````true````.
   */
  perspectivePoints?: boolean,

  /**
   * The minimum rendered size of {@link PointsMaterial} points when {@link PointsMaterial.perspectivePoints} is ````true````.
   *
   * Default value is ```````` pixels.
   */
  minPerspectivePointSize?: number,

  /**
   * The maximum rendered size of {@link PointsMaterial} points when {@link PointsMaterial.perspectivePoints} is ````true````.
   *
   * Default value is ````6```` pixels.
   */
  maxPerspectivePointSize?: number,

  /**
   * Whether the {@link PointsMaterial} points are made invisible when their intensity lies outside {@link PointsMaterial.minIntensity}
   * and {@link PointsMaterial.maxIntensity}.
   *
   * Default is ````false````.
   */
  filterIntensity?: boolean,

  /**
   * The minimum intensity of rendered {@link PointsMaterial} points when {@link PointsMaterial.filterIntensity} is ````true````.
   *
   * Default value is ````0.0````.
   */
  minIntensity?: number,

  /**
   * The maximum intensity of rendered {@link PointsMaterial} points when {@link PointsMaterial.filterIntensity} is ````true````.
   *
   * Default value is ````1.0````.
   */
  maxIntensity?: number
}
