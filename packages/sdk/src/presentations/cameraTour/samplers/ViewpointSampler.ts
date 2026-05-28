import type {SDKResult} from "../../../base/core";
import type {SceneModel} from "../../../model/scene";

import type {CameraTourPlanOptions} from "../plan/CameraTourPlanOptions";
import type {SpaceGraph} from "../graph/SpaceGraph";
import type {ViewpointGraph} from "../graph/ViewpointGraph";


/**
 * Inputs handed to {@link ViewpointSampler.sample}.
 */
export interface ViewpointSamplerInput {
  spaceGraph: SpaceGraph;
  sceneModel: SceneModel;
  options: Required<Omit<CameraTourPlanOptions, "onProgress" | "up" | "startSpaceId">> &
           Pick<CameraTourPlanOptions, "onProgress" | "up" | "startSpaceId">;
}


/**
 * Stage 2 of the {@link planCameraTour} pipeline — for each
 * {@link SpaceGraphNode} from the extractor, emit up to
 * {@link CameraTourPlanOptions.maxViewpointsPerRoom} candidate
 * camera placements, each scored for visibility / coverage.
 *
 * The default sampler (`sampleVisibilityGrid`) lays out a grid
 * of candidates inside each space, raycasts
 * {@link CameraTourPlanOptions.visibilityRayCount} rays from
 * each candidate against the scene collision index, and scores
 * by coverage. The cheaper alternative (`sampleRoomCentroid`)
 * emits one viewpoint per space, anchored at the centroid and
 * looking toward the nearest exit door.
 *
 * Implementations should:
 *  - honour {@link CameraTourPlanOptions.eyeHeight} when picking
 *    each candidate's vertical position;
 *  - honour {@link CameraTourPlanOptions.wallClearance} as a
 *    minimum distance from any blocker;
 *  - leave the per-space bucket empty (not crash) when no
 *    clearance-respecting placement is possible — the planner
 *    will skip that space.
 */
export interface ViewpointSampler {
  sample(input: ViewpointSamplerInput): Promise<SDKResult<ViewpointGraph>>;
}
