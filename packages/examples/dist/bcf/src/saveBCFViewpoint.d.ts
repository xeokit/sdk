import type { BCFViewpoint } from "./BCFViewpoint";
import type { SaveBCFViewpointParams } from "./SaveBCFViewpointParams";
/**
 * Saves a {@link @xeokit/viewer!View | View} or a {@link @xeokit/viewer!ViewLayer | ViewLayer} to a {@link BCFViewpoint}.
 *
 * See {@link @xeokit/bcf} for usage.
 *
 * @param params BCF saving parameers.
 * @returns The BCF viewpoint.
 */
export declare function saveBCFViewpoint(params: SaveBCFViewpointParams): BCFViewpoint;
