import {View, ViewLayer} from "@xeokit/viewer";

/**
 * Options for {@link saveBCFViewpoint}.
 *
 * See {@link @xeokit/bcf} for usage.
 */
export interface SaveBCFViewpointParams {

    /**
     * A {@link @xeokit/viewer!View | View} to save as a BCF viewpoint.
     *
     * This will save component states in the BCF (see {@link BCFComponents}) for all
     * {@link @xeokit/viewer!ViewObject | ViewObjects} in the given target View.
     *
     * This parameter is mutually exlusive to {@link SaveBCFViewpointParams.viewLayer}.
     */
    view?: View;

    /**
     * An existing {@link @xeokit/viewer!ViewLayer} to save as a BCF viewpoint.
     *
     * This will save component states in the BCF (see {@link BCFComponents}) for all
     * {@link @xeokit/viewer!ViewObject | ViewObjects} in the given target ViewLayer.
     *
     * This parameter is mutually exlusive to {@link SaveBCFViewpointParams.view}.
     */
    viewLayer?: ViewLayer;
}