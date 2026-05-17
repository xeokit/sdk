/**
 * Parameters for a {@link FrustumProjection}.
 *
 * * Returned by {@link FrustumProjection.toParams | FrustumProjection.toParams}
 * * Passed to {@link FrustumProjection.fromParams | FrustumProjection.fromParams}
 * * Located at {@link CameraParams.frustumProjection | CameraParams.frustumProjection}
 */
export interface FrustumProjectionParams {

  /**
   * Position of the {@link FrustumProjection | FrustumProjection's} far plane on the View-space Z-axis.
   *
   * Default value is ````10000````.
   *
   * @return {Number} Far frustum plane position.
   */
  far?: number;

  /**
   * Position of the {@link FrustumProjection | FrustumProjection's} near plane on the View-space Z-axis.
   *
   * Default value is ````0.1````.
   *
   * @return {Number} Left frustum plane position.
   */
  near?: number;

  /**
   * Position of the {@link FrustumProjection | FrustumProjection's} left plane on the View-space X-axis.
   *
   * Default value is ````-1.0````.
   *
   * @return {Number} Left frustum plane position.
   */
  left?: number;

  /**
   * Position of the {@link FrustumProjection | FrustumProjection's} right plane on the View-space X-axis.
   *
   * Default value is ````1.0````.
   *
   * @return {Number} Right frustum plane position.
   */
  right?: number;

  /**
   * Position of the {@link FrustumProjection | FrustumProjection's} bottom plane on the View-space Y-axis.
   *
   * Default value is ````-1.0````.
   *
   * @return {Number} Bottom frustum plane position.
   */
  bottom?: number;

  /**
   * Position of the {@link FrustumProjection | FrustumProjection's} top plane on the View-space Y-axis.
   *
   * Default value is ````1.0````.
   *
   * @return {Number} Top frustum plane position.
   */
  top?: number;
}
