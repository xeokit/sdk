/**
 * # xeokit Camera Tour Planner
 *
 * ---
 *
 * **Plans automatic camera walkthroughs of BIM building models.**
 *
 * ---
 *
 * Generates an ordered, cinematically smoothed sequence of
 * camera waypoints that tours every space in a building, threading
 * doors between rooms and dwelling on each so the viewer can
 * absorb the geometry. Inspired by Liu, Xu & Sun (2012),
 * *"Automatic camera path planning for IFC building models"*
 * (Automation in Construction).
 *
 * Pipeline:
 *  1. **Extract** spaces + door portals from the source
 *     (default: IFC semantic walk over a paired DataModel).
 *  2. **Sample** candidate viewpoints inside each space, scored
 *     by visibility coverage.
 *  3. **Plan** the tour order (greedy nearest-neighbour seed,
 *     refined by 2-opt by default; pass `planTourGreedy` to skip
 *     the refinement pass on time-critical paths).
 *  4. **Smooth** the discrete stops into a waypoint list ready
 *     for the existing
 *     {@link viewing!cameraFlight.CameraPath | CameraPath} +
 *     {@link viewing!cameraFlight.CameraPathAnimation | CameraPathAnimation}
 *     playback infrastructure.
 *
 * The planner is headless and returns pure data ({@link CameraTour})
 * — driving a View's Camera is the separate `playCameraTour`
 * helper's job, so the planning step can run on a server to
 * precompute tours shipped alongside the model.
 *
 * Source files are bucketed into `graph/` (the space + viewpoint
 * graph types), `plan/` (planning entry point + result/options
 * types), `build/` (the smoothing leg), and `play/` (playback
 * runtime). The strategy subdirs (`extractors/`, `samplers/`,
 * `planners/`) plus `internal/` round out the module. Every
 * symbol stays in this barrel's flat namespace — the subdirs
 * organise source files only.
 *
 * ## Usage
 *
 * Three steps: plan → play → drive. Each runs in isolation, so
 * planning can move to a server while the play + drive halves stay
 * client-side.
 *
 * ```ts
 * import {
 *   planCameraTour,
 *   playCameraTour,
 *   extractSpacesFromGeometry,
 * } from "@xeokit/sdk/presentations/cameraTour";
 * ```
 *
 * ### 1) Plan
 *
 * Pure data in, pure data out — safe to run on a server and cache
 * the result alongside the model. The IFC space extractor is the
 * default; pass `extractor: extractSpacesFromGeometry` for non-IFC
 * sources.
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
 * Drives the View's Camera through the planned waypoints. Returns a
 * {@link CameraTourPlayback} handle for pause / seek / dispose.
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
 * Wire the handle to your UI. Same control surface the demo
 * `cameraTourPanel` Studio panel uses, so this snippet doubles as
 * the contract for any custom UI.
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
 * For glTF / OBJ / dotbim models without `IfcSpace` metadata, swap
 * in the geometry-only extractor. Everything else stays the same.
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
