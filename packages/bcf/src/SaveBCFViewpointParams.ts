import type {View} from "@xeokit/viewer";

/**
 * Options for {@link @xeokit/bcf!saveBCFViewpoint | saveBCFViewpoint}.
 *
 * See {@link "@xeokit/bcf" | @xeokit/bcf} for usage.
 */
export interface SaveBCFViewpointParams {

    defaultInvisible?: boolean;

    /**
     * Whether to capture a snapshot image in the BCF viewpoint.
     *
     * The snapshot would be saved in {@link @xeokit/bcf!BCFViewpoint.snapshot | BCFViewpoint.snapshot}.
     */
    snapshot?: boolean;

    /**
     * Identifies the system that authors this BCF viewpoint.
     */
    originatingSystem?: string;

    /**
     * Whether to flip the direction of the {@link @xeokit/viewer!SectionPlane | SectionPlanes} captured in the BCF viewpoint.
     */
    reverseClippingPlanes?: boolean;

    /**
     * Value to set on {@link @xeokit/bcf!BCFSetupHints.openings_translucent | BCFSetupHints.openings_translucent} within the BCF viewpoint.
     */
    openings_translucent?: boolean;

    /**
     * Value to set on {@link @xeokit/bcf!BCFSetupHints.space_boundaries_translucent | BCFSetupHints.space_boundaries_translucent} within the BCF viewpoint.
     */
    space_boundaries_translucent?: boolean;

    /**
     * Value to set on {@link @xeokit/bcf!BCFSetupHints.spaces_translucent | BCFSetupHints.spaces_translucent} within the BCF viewpoint.
     */
    spaces_translucent?: boolean;

    /**
     * Value to set on {@link @xeokit/bcf!BCFSetupHints.openingsVisible | BCFSetupHints.openingsVisible} within the BCF viewpoint.
     */
    openingsVisible?: boolean;

    /**
     * Value to set on {@link @xeokit/bcf!BCFSetupHints.spaceBoundariesVisible | BCFSetupHints.spaceBoundariesVisible} within the BCF viewpoint.
     */
    spaceBoundariesVisible?: boolean;

    /**
     * Value to set on {@link @xeokit/bcf!BCFSetupHints.spacesVisible | BCFSetupHints.spacesVisible} within the BCF viewpoint.
     */
    spacesVisible?: boolean;

    /**
     * The {@link @xeokit/viewer!View | View} to save as a BCF viewpoint.
     *
     * This will save component states in the BCF (see {@link @xeokit/bcf!BCFComponents}) for all
     * {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     */
    view: View;

    /**
     * Only save BCF viewpoint components if their corresponding {@link @xeokit/viewer!ViewObject | ViewObjects}
     * are in {@link @xeokit/viewer!ViewLayer | ViewLayers} that match these IDs.
     *
     * The {@link @xeokit/bcf!saveBCFViewpoint | saveBCFViewpoint} function will silently ignore each component state that has no corresponding
     * ViewObject in any of these ViewLayers.
     *
     * Each ViewLayer's occurrence in {@link @xeokit/bcf!SaveBCFViewpointParams.excludeLayerIds | SaveBCFViewpointParams.excludeLayerIds} will override
     * its appearance in this list.
     */
    includeLayerIds?: string[]

    /**
     * Never save BCF viewpoint components if their corresponding {@link @xeokit/viewer!ViewObject | ViewObjects}
     * are in {@link @xeokit/viewer!ViewLayer |ViewLayers} that have the given IDs.
     *
     * The {@link @xeokit/bcf!saveBCFViewpoint | saveBCFViewpoint} function will silently ignore each component state that has a corresponding
     * ViewObject in any of these ViewLayers.
     *
     * Each ViewLayer's occurrence in this list will override its occurrance
     * in {@link @xeokit/bcf!SaveBCFViewpointParams.includeLayerIds}.
     */
    excludeLayerIds?: string[]
}
