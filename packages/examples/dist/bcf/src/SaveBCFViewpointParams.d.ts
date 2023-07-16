import type { View } from "@xeokit/viewer";
/**
 * Options for {@link @xeokit/bcf!saveBCFViewpoint}.
 *
 * See {@link @xeokit/bcf} for usage.
 */
export interface SaveBCFViewpointParams {
    /**
     * A {@link @xeokit/viewer!View | View} to save as a BCF viewpoint.
     *
     * This will save component states in the BCF (see {@link @xeokit/bcf!BCFComponents}) for all
     * {@link @xeokit/viewer!ViewObject | ViewObjects} in the given target View.
     */
    view?: View;
    /**
     * Only save BCF viewpoint components if their corresponding {@link @xeokit/viewer!ViewObject | ViewObjects}
     * are in {@link @xeokit/viewer!ViewLayer | ViewLayers} that have the given IDs.
     *
     * The {@link @xeokit/bcf!saveBCFViewpoint} function will silently ignore each component state that has no corresponding
     * ViewObject in any of these ViewLayers.
     *
     * Each ViewLayer's occurrence in {@link @xeokit/bcf!SaveBCFViewpointParams.excludeLayerIds | SaveBCFViewpointParams.excludeLayerIds} will override
     * its appearance in this list.
     */
    includeLayerIds?: string[];
    /**
     * Never save BCF viewpoint components if their corresponding {@link @xeokit/viewer!ViewObject | ViewObjects}
     * are in {@link @xeokit/viewer!ViewLayer |ViewLayers} that have the given IDs.
     *
     * The {@link @xeokit/bcf!saveBCFViewpoint} function will silently ignore each component state that has a corresponding
     * ViewObject in any of these ViewLayers.
     *
     * Each ViewLayer's occurrence in this list will override its occurrance
     * in {@link @xeokit/bcf!SaveBCFViewpointParams.includeLayerIds}.
     */
    excludeLayerIds?: string[];
}
