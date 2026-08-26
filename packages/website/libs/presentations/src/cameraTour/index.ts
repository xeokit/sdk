/**
 * # Camera Tour Planner
 *
 * Builds camera waypoint sequences for building walkthroughs.
 * The planner extracts spaces and portals, samples viewpoints,
 * orders them, then smooths the result into a {@link CameraTour}.
 * Inspired by Liu, Xu & Sun (2012),
 * *"Automatic camera path planning for IFC building models"*
 * (Automation in Construction).
 *
 * Pipeline:
 *  1. **Extract** spaces + door portals from the source
 *     (default: IFC semantic walk over a paired DataModel).
 *  2. **Sample** candidate viewpoints inside each space, scored
 *     by visibility coverage.
 *  3. **Plan** the tour order. The default starts with a greedy
 *     nearest-neighbour pass and refines with 2-opt. Pass
 *     `planTourGreedy` to skip refinement.
 *  4. **Smooth** the stops into a waypoint list ready for
 *     {@link viewing!cameraFlight.CameraPath | CameraPath} +
 *     {@link viewing!cameraFlight.CameraPathAnimation | CameraPathAnimation}
 *     playback.
 *
 * The planner returns data only. `playCameraTour` applies a tour to
 * a View's Camera, so tours can be planned server-side and loaded
 * with a model.
 *
 * Source files are bucketed into `graph/` (the space + viewpoint
 * graph types), `plan/` (planning entry point + result/options
 * types), `build/` (the smoothing leg), and `play/` (playback
 * runtime). The strategy subdirs (`extractors/`, `samplers/`,
 * `planners/`) and `internal/` are part of the same module. The
 * public symbols are re-exported from this barrel.
 *
 * ## Usage
 *
 * Three steps: plan, play, then drive the playback handle from UI.
 *
 * ```ts
 * import {
 *   planCameraTour,
 *   playCameraTour,
 *   extractSpacesFromGeometry,
 * } from "../libs/presentations/dist/index.js";
 * ```
 *
 * ### 1) Plan
 *
 * Planning is data-only. The IFC space extractor is the default;
 * pass `extractor: extractSpacesFromGeometry` for non-IFC sources.
 *
 * ```ts
 * const planResult = await planCameraTour({
 *   sceneModel: scene.models["building"],
 *   dataModel:  data.models["building"],
 *   options: {
 *     samplesPerSpace:   8,
 *     dwellSeconds:      2.5,
 *     transitionSeconds: 1.5,
 *   },
 * });
 *
 * if (!planResult.ok) throw new Error(planResult.error);
 * const tour = planResult.value;
 * ```
 *
 * ### 2) Play
 *
 * Drives the View's Camera through the planned waypoints and returns
 * a {@link CameraTourPlayback} handle for pause, seek, and disposal.
 *
 * ```ts
 * const playResult = playCameraTour(view, tour, {
 *   rate:       1.0,
 *   loop:       false,
 *   onWaypoint: (i, w) => console.log(`Now in ${w.spaceLabel}`),
 * });
 *
 * if (!playResult.ok) throw new Error(playResult.error);
 * const playback = playResult.value;
 * ```
 *
 * ### 3) Drive
 *
 * Wire the playback handle to the host UI.
 *
 * ```ts
 * pauseBtn.onclick   = () => playback.pause();
 * playBtn.onclick    = () => playback.play();
 * seekSlider.oninput = () => {
 *   playback.progress = +seekSlider.value / 100;
 * };
 * ```
 *
 * ### Non-IFC sources
 *
 * For glTF, OBJ, dotbim, or other sources without `IfcSpace`
 * metadata, use the geometry-only extractor.
 *
 * ```ts
 * const planResult = await planCameraTour({
 *   sceneModel: scene.models["mesh-only"],
 *   extractor:  extractSpacesFromGeometry,
 * });
 * ```
 *
 * @module cameraTour
 */
export * from "./graph/SpaceGraph";
export * from "./graph/SpaceGraphEdge";
export * from "./graph/SpaceGraphNode";
export * from "./graph/ViewpointGraph";
export * from "./graph/ViewpointGraphNode";

export * from "./plan/CameraTour";
export * from "./plan/CameraTourPlanOptions";
export * from "./plan/CameraTourPlanParams";
export * from "./plan/CameraTourWaypoint";
export * from "./plan/planCameraTour";

export * from "./build/BuildTourWaypointsInput";
export * from "./build/BuildTourWaypointsResult";
export * from "./build/buildTourWaypoints";

export * from "./play/CameraTourPlayback";
export * from "./play/PlayCameraTourOptions";
export * from "./play/playCameraTour";

export * from "./extractors/SpaceExtractor";
export * from "./extractors/extractSpacesFromIfc";
export * from "./extractors/extractSpacesFromGeometry";

export * from "./samplers/ViewpointSampler";
export * from "./samplers/sampleVisibilityGrid";

export * from "./planners/TourPlanner";
export * from "./planners/planTourGreedy";
export * from "./planners/planTourTwoOpt";
