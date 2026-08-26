/**
 * # xeokit Aircraft Simulation
 *
 * Aircraft-style vehicle control for a {@link viewing!viewer.View | View}.
 *
 * This module wraps VehicleNavigationController
 * with aircraft-specific pose mapping, camera presets, cockpit/exterior view
 * controls, exhaust trail geometry, and optional afterburner visuals. It is
 * intended for demos and interactive viewers that need a flyable model.
 *
 * The controller drives a caller-owned {@link model!scene.SceneTransform |
 * SceneTransform}. Put the aircraft model's meshes under that transform, then
 * create an {@link AircraftController} for the active View. The controller
 * updates the transform each animation tick and keeps the View camera tracking
 * the vehicle.
 *
 * ## Controls
 *
 * When keyboard binding is enabled, the controller reserves these camera keys:
 *
 * - `0`: trailing chase camera
 * - `1`: left exterior camera
 * - `2`: right exterior camera
 * - `3`: front exterior camera
 * - `4`: top camera
 * - `5`: top trailing camera
 * - `6`: rear wide camera
 * - `7`: cockpit camera
 * - `-` / `+`: move the active exterior camera closer / farther
 *
 * Movement input is handled by the underlying vehicle navigation controller.
 *
 * ## Basic Usage
 *
 * ```ts
 * import { AircraftController } from "../libs/examples/dist/aircraft/index.js";
 *
 * const sceneModel = scene.createModel({id: "aircraft"}).value;
 * const rootTransform = sceneModel.createTransform({
 *   id: "aircraftRoot",
 *   matrix: [
 *     1, 0, 0, 0,
 *     0, 1, 0, 0,
 *     0, 0, 1, 0,
 *     0, 0, 0, 1
 *   ]
 * }).value;
 *
 * // Create or load aircraft meshes with parentTransformId: "aircraftRoot".
 *
 * const controller = new AircraftController(view, {
 *   rootTransform,
 *   config: {
 *     modelId: "aircraft",
 *     forwardAxis: "-Z",
 *     startSpeed: 35,
 *     maxForwardSpeed: 135,
 *     startFlying: true
 *   }
 * });
 *
 * // Later:
 * controller.setCameraPreset("front");
 * controller.destroy();
 * ```
 *
 * ## Exhaust and Afterburner
 *
 * ```ts
 * import {
 *   AircraftController,
 *   AircraftExhaustTrail
 * } from "../libs/examples/dist/aircraft/index.js";
 *
 * const config = {
 *   modelId: "aircraft",
 *   forwardAxis: "-Z",
 *   exhaust: {
 *     offset: [0, -0.8, 0],
 *     trailLength: 42,
 *     trailSegments: 24,
 *     radius: 0.9
 *   },
 *   afterburner: {
 *     threshold: 0.7,
 *     length: 10,
 *     radius: 0.8
 *   }
 * };
 *
 * const exhaust = new AircraftExhaustTrail({
 *   scene,
 *   modelId: "aircraft",
 *   coordinateSystem: sceneModel.coordinateSystem,
 *   config
 * });
 *
 * const controller = new AircraftController(view, {
 *   rootTransform,
 *   exhaust,
 *   config
 * });
 * ```
 *
 * ## Cockpit Camera
 *
 * ```ts
 * const controller = new AircraftController(view, {
 *   rootTransform,
 *   config: {
 *     forwardAxis: "-Z",
 *     cameraCockpitEyeOffset: [0, -1.45, -0.35],
 *     cameraCockpitLookOffset: [0, -14, -0.25]
 *   }
 * });
 *
 * controller.setCameraPreset("cockpit");
 * ```
 *
 * @module aircraft
 */
export * from "./AircraftAudio";
export * from "./AircraftController";
export * from "./AircraftControllerParams";
export * from "./AircraftExhaustTrail";
export type {AircraftForwardAxis} from "./AircraftMath";
