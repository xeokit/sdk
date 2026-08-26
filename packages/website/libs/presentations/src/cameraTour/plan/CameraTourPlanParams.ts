import type {DataModel} from "@xeokit/sdk/model/data";
import type {SceneModel} from "@xeokit/sdk/model/scene";

import type {CameraTourPlanOptions} from "./CameraTourPlanOptions";
import type {SpaceExtractor} from "../extractors/SpaceExtractor";
import type {ViewpointSampler} from "../samplers/ViewpointSampler";
import type {TourPlanner} from "../planners/TourPlanner";


/**
 * Top-level input to {@link planCameraTour}. Couples the source
 * model with optional semantic data and per-stage strategy
 * overrides.
 *
 * The {@link extractor} default is the IFC extractor — it walks
 * `dataModel.objectsByType["IfcSpace"]` plus
 * `IfcRelSpaceBoundary` / `IfcDoor` adjacency. Supply a custom
 * extractor (or the geometry-fallback one) for SceneModels
 * without a paired DataModel.
 */
export interface CameraTourPlanParams {

  /**
   * Source SceneModel — the geometry the camera will walk
   * through. The collision index is read off `sceneModel.scene`
   * internally for occlusion + raycasting work.
   */
  sceneModel: SceneModel;

  /**
   * Optional DataModel paired with `sceneModel`. Required by the
   * default IFC {@link SpaceExtractor}; ignored by geometry-only
   * extractors.
   */
  dataModel?: DataModel;

  /**
   * Per-call tuning. All fields optional; see
   * {@link CameraTourPlanOptions} for defaults.
   */
  options?: CameraTourPlanOptions;

  /**
   * Strategy override — defaults to the IFC extractor. Swap to
   * `extractSpacesFromGeometry` for non-IFC sources, or provide
   * a custom extractor for proprietary schemas.
   */
  extractor?: SpaceExtractor;

  /**
   * Strategy override — defaults to the visibility-grid sampler,
   * which raycasts from candidates against the scene collision
   * index and scores by coverage. Swap to `sampleRoomCentroid`
   * for a cheaper "one viewpoint per room" path.
   */
  sampler?: ViewpointSampler;

  /**
   * Strategy override — defaults to `planTourTwoOpt` (greedy
   * nearest-neighbour seed, then 2-opt-refined for shorter tours
   * on convoluted floor plans). Swap to `planTourGreedy` to skip
   * the refinement pass when latency matters more than tour
   * quality (e.g. headless precompute that runs per save).
   */
  planner?: TourPlanner;
}
