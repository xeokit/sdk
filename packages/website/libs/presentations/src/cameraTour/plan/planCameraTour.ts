import {SDKErrorType, type SDKResult} from "@xeokit/sdk/base/core";

import type {CameraTour} from "./CameraTour";
import type {CameraTourPlanOptions} from "./CameraTourPlanOptions";
import type {CameraTourPlanParams} from "./CameraTourPlanParams";
import {buildTourWaypoints} from "../build/buildTourWaypoints";
import {extractSpacesFromIfc} from "../extractors/extractSpacesFromIfc";
import {sampleVisibilityGrid} from "../samplers/sampleVisibilityGrid";
import {planTourTwoOpt} from "../planners/planTourTwoOpt";


/**
 * Defaults applied to {@link CameraTourPlanOptions} fields the
 * stages depend on. Caller-supplied values override these.
 *
 * `up`, `startSpaceId`, and `onProgress` stay optional — the
 * stages resolve `up` from the source Scene's
 * `coordinateSystem.worldUp` when absent.
 */
const DEFAULTS: Required<Omit<CameraTourPlanOptions, "up" | "startSpaceId" | "onProgress">> = {
  eyeHeight:            1.7,
  wallClearance:        0.4,
  maxViewpointsPerRoom: 8,
  visibilityRayCount:   64,
  dwellMs:              2000,
  flightDurationMs:     1500,
  fovDeg:               60,
};


/**
 * Compose the four-stage camera-tour planning pipeline:
 *
 *  1. **Extract** — {@link SpaceExtractor} turns the source into a
 *     {@link SpaceGraph}. Defaults to {@link extractSpacesFromIfc}.
 *  2. **Sample** — {@link ViewpointSampler} emits candidate
 *     viewpoints per space, scored for visibility. Defaults to
 *     {@link sampleVisibilityGrid}.
 *  3. **Plan tour** — {@link TourPlanner} picks the order and
 *     the chosen viewpoint per stop. Defaults to
 *     {@link planTourTwoOpt} (greedy NN seeded then refined by
 *     2-opt swaps). Pass `planTourGreedy` directly via
 *     `params.planner` to skip the refinement pass on time-
 *     critical / headless paths.
 *  4. **Smooth** — {@link buildTourWaypoints} inserts portal-
 *     transit waypoints between adjacent room transitions and
 *     emits the final flat waypoint list.
 *
 * The defaults target IFC building models — supply a DataModel
 * paired with the SceneModel and the pipeline self-configures.
 * For non-IFC sources, override
 * {@link CameraTourPlanParams.extractor} with a geometry-fallback
 * extractor.
 *
 * Returns the tour as pure data — playback against a `View` is
 * `playCameraTour`'s job and is decoupled so the planner can run
 * headless (e.g. on a server to precompute tours).
 */
export async function planCameraTour(
    params: CameraTourPlanParams,
): Promise<SDKResult<CameraTour>> {

  if (!params || !params.sceneModel) {
    return err(SDKErrorType.InvalidInput,
        "[planCameraTour] sceneModel is required");
  }
  if (params.sceneModel.destroyed) {
    return err(SDKErrorType.InvalidOperation,
        "[planCameraTour] sceneModel is destroyed");
  }

  // Resolve defaults — keep the partial options shape stages
  // expect (Required-on-defaulted-fields + still-optional triple).
  const userOpts = params.options ?? {};
  const options = {
    ...DEFAULTS,
    ...userOpts,
  };

  const extractor = params.extractor ?? extractSpacesFromIfc;
  const sampler   = params.sampler   ?? sampleVisibilityGrid;
  const planner   = params.planner   ?? planTourTwoOpt;

  // 1) Extract.
  const spaceRes = await extractor.extract({
    sceneModel: params.sceneModel,
    dataModel:  params.dataModel,
    options,
  });
  if (spaceRes.ok === false) return spaceRes;
  const spaceGraph = spaceRes.value;
  if (spaceGraph.nodes.length === 0) {
    return err(SDKErrorType.InvalidInput,
        "[planCameraTour] Extractor returned no spaces. For non-IFC " +
        "sources pass `params.extractor = extractSpacesFromGeometry`.");
  }

  // 2) Sample.
  const vpRes = await sampler.sample({
    spaceGraph,
    sceneModel: params.sceneModel,
    options,
  });
  if (vpRes.ok === false) return vpRes;
  const viewpointGraph = vpRes.value;

  // 3) Plan tour.
  const planRes = await planner.plan({
    spaceGraph,
    viewpointGraph,
    options,
  });
  if (planRes.ok === false) return planRes;
  const tourPlan = planRes.value;

  // 4) Smooth.
  options.onProgress?.("smooth", 0);
  const sceneUp = params.sceneModel.scene.coordinateSystem.worldUp;
  const up: [number, number, number] = options.up
      ? [options.up[0], options.up[1], options.up[2]]
      : [sceneUp[0], sceneUp[1], sceneUp[2]];
  const smoothed = buildTourWaypoints({
    stops:          tourPlan.stops,
    spaceGraph,
    viewpointGraph,
    options:        {
      eyeHeight:        options.eyeHeight,
      dwellMs:          options.dwellMs,
      flightDurationMs: options.flightDurationMs,
    },
    up,
  });
  options.onProgress?.("smooth", 1);

  if (smoothed.waypoints.length === 0) {
    return err(SDKErrorType.InvalidInput,
        "[planCameraTour] Planner returned no usable stops " +
        "(all spaces had unresolved viewpoints).");
  }

  return {
    ok: true,
    value: {
      waypoints:           smoothed.waypoints,
      spaceGraph,
      estimatedDurationMs: smoothed.estimatedDurationMs,
    },
  };
}


function err<T>(type: SDKErrorType, message: string): SDKResult<T> {
  return {ok: false, type, error: message};
}
