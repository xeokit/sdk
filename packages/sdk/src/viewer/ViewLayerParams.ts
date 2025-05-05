/**
 * Parameters for a {@link ViewLayer}.
 *
 * * Returned by {@link ViewLayer.toParams | ViewLayer.toParams}
 * * Passed to {@link ViewLayer.fromParams | ViewLayer.fromParams} and {@link View.createLayer | View.createLayer}
 * * Located at {@link ViewParams.layers | ViewParams.layers}
 */
export interface ViewLayerParams {

  /**
     * ID for the new ViewLayer.
     *
     * The ViewLayer is registered by this ID in {@link View.layers}.
     */
  id: string;

  /**
     * Default initial visibility of the {@link ViewObject | ViewObjects} in the new ViewLayer.
     */
  visible?: boolean;

  /**
     * When true, View destroys the ViewLayer as soon as there are no ViewObjects that need it. When false, the View will retain it.
     */
  autoDestroy?: boolean;
}
