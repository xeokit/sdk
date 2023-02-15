import {View} from "@xeokit/viewer";
import {BCFViewpoint} from "./BCFViewpoint";

/**
 * Options for {@link loadBCFViewpoint}.
 *
 * See {@link @xeokit/bcf} for usage.
 */
export interface LoadBCFViewpointParams {

    /**
     * A BIM Collaboration Format (BCF) viewpoint to load.
     */
    bcfViewpoint: BCFViewpoint;

    /**
     * A {@link @xeokit/viewer!View | View} to load the BCF viewpoint's component states into.
     *
     * This will load the viewpoint's component states (see {@link BCFComponents}) into their corresponding
     * {@link @xeokit/viewer!ViewObject | ViewObjects} within the given target View, ignoring any
     * {@link @xeokit/viewer!ViewLayer | ViewLayers} that those ViewObjects may have been partitioned into.
     *
     * The {@link loadBCFViewpoint} function will silently ignore each component state that has no corresponding
     * ViewObject in the target View.
     *
     * This parameter is mutually exlusive to {@link LoadBCFViewpointParams.viewLayer}.
     */
    view: View;

    /**
     * Only load BCF viewpoint components if their corresponding {@link @xeokit/view!ViewObject | ViewObjects}
     * are in {@link @xeokit/viewer!ViewLayer |ViewLayers} that have the given IDs.
     *
     * The {@link loadBCFViewpoint} function will silently ignore each component state that has no corresponding
     * ViewObject in any of these ViewLayers.
     *
     * Each ViewLayer's occurrence in {@link LoadBCFViewpointParams.excludeViewLayerIds} will override
     * its appearance in this list.
     */
    includeViewLayerIds?: string[]

    /**
     * Never load BCF viewpoint components if their corresponding {@link @xeokit/view!ViewObject | ViewObjects}
     * are in {@link @xeokit/viewer!ViewLayer |ViewLayers} that have the given IDs.
     *
     * The {@link loadBCFViewpoint} function will silently ignore each component state that has a corresponding
     * ViewObject in any of these ViewLayers.
     *
     * Each ViewLayer's occurrence in this list will override its occurrance
     * in {@link LoadBCFViewpointParams.includeViewLayerIds}.
     */
    excludeViewLayerIds?: string[]
}