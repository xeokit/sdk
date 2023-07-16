/**
 * {@link @xeokit/viewer!ViewLayer} creation parameters for {@link View.createLayer}.
 */
export interface ViewLayerParams {

    /**
     * ID for the new ViewLayer.
     *
     * The ViewLayer is registered by this ID in {@link View.layers}.
     */
    id: string;

    /**
     * Default initial visibility of the {@link @xeokit/viewer!ViewObject | ViewObjects} in the new ViewLayer.
     */
    visible?: boolean;
}