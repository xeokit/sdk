import type { View } from "../viewer";
/**
 * Parameters for {@link saveBCFViewpoint | saveBCFViewpoint}.
 *
 * See {@link bcf | @xeokit/sdk/bcf}  for usage.
 */
export interface SaveBCFViewpointParams {
    defaultInvisible?: boolean;
    /**
     * Whether to capture a snapshot image in the BCF viewpoint.
     *
     * The snapshot would be saved in {@link BCFViewpoint.snapshot | BCFViewpoint.snapshot}.
     */
    snapshot?: boolean;
    /**
     * Identifies the system that authors this BCF viewpoint.
     */
    originatingSystem?: string;
    /**
     * Whether to flip the direction of the {@link viewer!SectionPlane | SectionPlanes} captured in the BCF viewpoint.
     */
    reverseClippingPlanes?: boolean;
    /**
     * Value to set on {@link BCFViewSetupHints.openings_translucent | BCFViewSetupHints.openings_translucent} within the BCF viewpoint.
     */
    openings_translucent?: boolean;
    /**
     * Value to set on {@link BCFViewSetupHints.space_boundaries_translucent | BCFViewSetupHints.space_boundaries_translucent} within the BCF viewpoint.
     */
    space_boundaries_translucent?: boolean;
    /**
     * Value to set on {@link BCFViewSetupHints.spaces_translucent | BCFViewSetupHints.spaces_translucent} within the BCF viewpoint.
     */
    spaces_translucent?: boolean;
    /**
     * Value to set on {@link BCFViewSetupHints.openings_visible | BCFViewSetupHints.openings_visible} within the BCF viewpoint.
     */
    openingsVisible?: boolean;
    /**
     * Value to set on {@link BCFViewSetupHints.space_boundaries_visible | BCFViewSetupHints.space_boundaries_visible} within the BCF viewpoint.
     */
    spaceBoundariesVisible?: boolean;
    /**
     * Value to set on {@link BCFViewSetupHints.spaces_visible | BCFViewSetupHints.spaces_visible} within the BCF viewpoint.
     */
    spacesVisible?: boolean;
    /**
     * The {@link viewer!View | View} to export as a BCF viewpoint.
     *
     * This will export component states in the BCF (see {@link BCFComponents}) for all
     * {@link viewer!ViewObject | ViewObjects} in this View.
     */
    view: View;
    /**
     * Only export BCF viewpoint components if their corresponding {@link viewer!ViewObject | ViewObjects}
     * are in {@link viewer!ViewLayer | ViewLayers} that match these IDs.
     *
     * The {@link saveBCFViewpoint | saveBCFViewpoint} function will silently ignore each component state that has no corresponding
     * ViewObject in any of these ViewLayers.
     *
     * Each ViewLayer's occurrence in {@link SaveBCFViewpointParams.excludeViewLayerIds | SaveBCFViewpointParams.excludeViewLayerIds} will override
     * its appearance in this list.
     */
    includeViewLayerIds?: string[];
    /**
     * Never export BCF viewpoint components if their corresponding {@link viewer!ViewObject | ViewObjects}
     * are in {@link viewer!ViewLayer |ViewLayers} that have the given IDs.
     *
     * The {@link saveBCFViewpoint | saveBCFViewpoint} function will silently ignore each component state that has a corresponding
     * ViewObject in any of these ViewLayers.
     *
     * Each ViewLayer's occurrence in this list will override its occurrance
     * in {@link SaveBCFViewpointParams.includeViewLayerIds}.
     */
    excludeViewLayerIds?: string[];
}
//# sourceMappingURL=SaveBCFViewpointParams.d.ts.map
