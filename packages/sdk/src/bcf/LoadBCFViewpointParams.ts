import type { BCFViewpoint } from "./BCFViewpoint";
import type { Data } from "../data";
import type { View } from "../viewer";

/**
 * Options for {@link loadBCFViewpoint | loadBCFViewpoint}.
 *
 * See {@link "bcf" | @xeokit/sdk/bcf} for usage.
 */
export interface LoadBCFViewpointParams {

  /**
     * Identifies the system from where the BCF viewpoint originates.
     */
  originatingSystem?: string;

  /**
     * When ````true````, then when visibility and selection updates refer to composite objects (eg. an IfcBuildingStorey),
     * then this method will apply the updates to objects within those composites.
     */
  updateCompositeObjects?: boolean;

  /**
     * Whether to flip the direction of the slicing planes in the BCF viewpoint.
     *
     * Default is `false`.
     */
  reverseClippingPlanes?: boolean;

  /**
     * Whether to reset the selection and X-ray states of {@link viewer!ViewObject | ViewObjects} within the given target {@link viewer!View | View}.
     *
     * Default is `false`.
     */
  reset?: boolean;

  /**
     * When ````true```` (default), will attempt to set {@link viewer!Camera.look | Camera.look} to the closest
     * point of surface intersection with a ray fired from the BCF ````camera_view_point```` in the direction of ````camera_direction````.
     *
     * Default is `true`.
     */
  rayCast?: boolean;

  /**
     * A BIM Collaboration Format (BCF) viewpoint to load.
     */
  bcfViewpoint: BCFViewpoint;

  /**
     * A {@link viewer!View | View} to load the BCF viewpoint's component states into.
     *
     * This will load the viewpoint's component states (see {@link BCFComponents}) into their corresponding
     * {@link viewer!ViewObject | ViewObjects} within the given target View, ignoring any
     * {@link viewer!ViewLayer | ViewLayers} that those ViewObjects may have been partitioned into.
     *
     * The {@link loadBCFViewpoint | loadBCFViewpoint} function will silently ignore each component state that has no corresponding
     * ViewObject in the target View.
     */
  view: View;

  /**
     * A {@link data!Data | Data} to classify the objects in the {@link viewer!View | View} we're loading the BCF viewpoint's component states into
     */
  data: Data;

  /**
     * Only load BCF viewpoint components if their corresponding {@link viewer!ViewObject | ViewObjects}
     * are in {@link viewer!ViewLayer |ViewLayers} that have the given IDs.
     *
     * The {@link loadBCFViewpoint | loadBCFViewpoint} function will silently ignore each component state that has no corresponding
     * ViewObject in any of these ViewLayers.
     *
     * Each ViewLayer's occurrence in {@link LoadBCFViewpointParams.excludeViewLayerIds | LoadBCFViewpointParams.excludeViewLayerIds} will override
     * its appearance in this list.
     */
  includeViewLayerIds?: string[]

  /**
     * Never load BCF viewpoint components if their corresponding {@link viewer!ViewObject | ViewObjects}
     * are in {@link viewer!ViewLayer | ViewLayers} that have the given IDs.
     *
     * The {@link loadBCFViewpoint | loadBCFViewpoint} function will silently ignore each component state that has a corresponding
     * ViewObject in any of these ViewLayers.
     *
     * Each ViewLayer's occurrence in this list will override its occurrance
     * in {@link LoadBCFViewpointParams.includeViewLayerIds | LoadBCFViewpointParams.includeViewLayerIds}.
     */
  excludeViewLayerIds?: string[]
}
