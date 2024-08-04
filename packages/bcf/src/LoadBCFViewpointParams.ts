import type {View} from "@xeokit/viewer";
import type {BCFViewpoint} from "./BCFViewpoint";
import {Data} from "@xeokit/data";

/**
 * Options for {@link @xeokit/bcf!loadBCFViewpoint | loadBCFViewpoint}.
 *
 * See {@link "@xeokit/bcf" | @xeokit/bcf} for usage.
 */
export interface LoadBCFViewpointParams {

    duration?: number;
    originatingSystem?: string;
    updateCompositeObjects?: boolean;
    reverseClippingPlanes?: boolean;
    reset?: boolean;
    immediate?: boolean;

    rayCast?: boolean;

    /**
     * A BIM Collaboration Format (BCF) viewpoint to load.
     */
    bcfViewpoint: BCFViewpoint;

    /**
     * A {@link @xeokit/viewer!View | View} to load the BCF viewpoint's component states into.
     *
     * This will load the viewpoint's component states (see {@link @xeokit/bcf!BCFComponents}) into their corresponding
     * {@link @xeokit/viewer!ViewObject | ViewObjects} within the given target View, ignoring any
     * {@link @xeokit/viewer!ViewLayer | ViewLayers} that those ViewObjects may have been partitioned into.
     *
     * The {@link @xeokit/bcf!loadBCFViewpoint | loadBCFViewpoint} function will silently ignore each component state that has no corresponding
     * ViewObject in the target View.
     */
    view: View;

    /**
     * A {@link @xeokit/data!Data | Data} to classify the objects in the {@link @xeokit/viewer!View | View} we're loading the BCF viewpoint's component states into
     */
    data?: Data;

    /**
     * Only load BCF viewpoint components if their corresponding {@link @xeokit/viewer!ViewObject | ViewObjects}
     * are in {@link @xeokit/viewer!ViewLayer |ViewLayers} that have the given IDs.
     *
     * The {@link @xeokit/bcf!loadBCFViewpoint | loadBCFViewpoint} function will silently ignore each component state that has no corresponding
     * ViewObject in any of these ViewLayers.
     *
     * Each ViewLayer's occurrence in {@link @xeokit/bcf!LoadBCFViewpointParams.excludeLayerIds | LoadBCFViewpointParams.excludeLayerIds} will override
     * its appearance in this list.
     */
    includeLayerIds?: string[]

    /**
     * Never load BCF viewpoint components if their corresponding {@link @xeokit/viewer!ViewObject | ViewObjects}
     * are in {@link @xeokit/viewer!ViewLayer | ViewLayers} that have the given IDs.
     *
     * The {@link @xeokit/bcf!loadBCFViewpoint | loadBCFViewpoint} function will silently ignore each component state that has a corresponding
     * ViewObject in any of these ViewLayers.
     *
     * Each ViewLayer's occurrence in this list will override its occurrance
     * in {@link @xeokit/bcf!LoadBCFViewpointParams.includeLayerIds | LoadBCFViewpointParams.includeLayerIds}.
     */
    excludeLayerIds?: string[]
}
