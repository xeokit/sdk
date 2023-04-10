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
     */
    view?: View;

    /**
     * Only save BCF viewpoint components if their corresponding {@link @xeokit/view!ViewObject | ViewObjects}
     * are in {@link @xeokit/viewer!ViewLayer | ViewLayers} that have the given IDs.
     *
     * The {@link saveBCFViewpoint} function will silently ignore each component state that has no corresponding
     * ViewObject in any of these ViewLayers.
     *
     * Each ViewLayer's occurrence in {@link SaveBCFViewpointParams.excludeLayerIds} will override
     * its appearance in this list.
     */
    includeLayerIds?: string[]

    /**
     * Never save BCF viewpoint components if their corresponding {@link @xeokit/view!ViewObject | ViewObjects}
     * are in {@link @xeokit/viewer!ViewLayer |ViewLayers} that have the given IDs.
     *
     * The {@link saveBCFViewpoint} function will silently ignore each component state that has a corresponding
     * ViewObject in any of these ViewLayers.
     *
     * Each ViewLayer's occurrence in this list will override its occurrance
     * in {@link SaveBCFViewpointParams.includeLayerIds}.
     */
    excludeLayerIds?: string[]
}