/**
 * # xeokit Camera Flight
 *
 * ---
 *
 * **Camera animations for a {@link viewing!viewer.View | View} —
 * fly-to a target, jump-to a target, or animate the camera along
 * a multi-frame path with eased segments.**
 *
 * ---
 *
 * The `cameraFlight` module animates a
 * {@link viewing!viewer.Camera | Camera} between viewpoints rather
 * than snapping it. Two entry points:
 *
 *   - {@link CameraFlightAnimation} — fly to or jump to a single
 *     target (`{eye, look, up}` triple, an AABB, or a
 *     {@link viewing!viewer.ViewObject | ViewObject}). Used for
 *     "focus on this object" and "frame this region" interactions.
 *   - {@link CameraPathAnimation} — animate the camera along a
 *     pre-defined {@link CameraPath} of timed frames. Used for
 *     scripted tours and recorded camera fly-throughs.
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class CameraFlightAnimation {
 *       +view : View
 *       +duration / fitFOV / fit
 *       +flyTo(params)
 *       +jumpTo(params)
 *       +stop()
 *       +destroy()
 *     }
 *     class CameraPath {
 *       +frames : { eye, look, up, t }[]
 *       +addFrame(frame)
 *       +loadFromJSON(json)
 *       +saveToJSON()
 *     }
 *     class CameraPathAnimation {
 *       +view  : View
 *       +path  : CameraPath
 *       +play() / pause() / stop()
 *       +seek(t)
 *     }
 *     class FlyToParams {
 *       +eye? / look? / up?
 *       +aabb?       : AABB3
 *       +viewObject? : ViewObject
 *       +projection?
 *       +duration?
 *     }
 *     class View {
 *       <<viewer>>
 *     }
 *     class Camera {
 *       <<viewer>>
 *     }
 *     class ViewObject {
 *       <<viewer>>
 *     }
 *     CameraFlightAnimation o-- View : drives Camera
 *     CameraFlightAnimation ..> FlyToParams : reads
 *     FlyToParams o-- ViewObject : optional target
 *     CameraPathAnimation o-- View
 *     CameraPathAnimation o-- CameraPath : plays
 *     View *-- Camera
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Fly to a target** — point the camera at a
 *   {@link viewing!viewer.ViewObject | ViewObject} or AABB without
 *   the caller computing camera positions; the helper fits the
 *   target to the View's FOV.
 * - **Jump to a target** — same target shapes, instant transition.
 *   Right for keyboard shortcuts and reset-view actions.
 * - **Eased transitions** — flights use a smooth in-out easing so
 *   they read naturally; per-call `duration` overrides the default.
 * - **Projection switch in flight** — pass `projection:
 *   "ortho"` / `"perspective"` to switch projection during the
 *   transition; the View's projection mode flips at the end.
 * - **CameraPath sequences** — multi-frame paths with per-frame
 *   `{eye, look, up, t}` build scripted fly-throughs;
 *   {@link CameraPathAnimation} plays / pauses / scrubs them.
 * - **JSON round-trip** — paths serialise via `saveToJSON()` and
 *   load via `loadFromJSON()`, so tours travel with a project.
 *
 * <br>
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * <br>
 *
 * ## Quick Start
 *
 * ### 1) Import the entry points
 *
 * ```javascript
 * import {
 *   CameraFlightAnimation,
 *   CameraPath,
 *   CameraPathAnimation
 * } from "@xeokit/sdk/viewing/cameraFlight";
 * ```
 *
 * <br>
 *
 * ### 2) Fly to a ViewObject
 *
 * ```javascript
 * const flight = new CameraFlightAnimation(view);
 *
 * flight.flyTo({
 *   viewObject: view.objects["building"],
 *   duration:   1.2,
 *   fitFOV:     45                            // degrees
 * });
 * ```
 *
 * <br>
 *
 * ### 3) Jump to an explicit camera pose
 *
 * ```javascript
 * flight.jumpTo({
 *   eye:  [10, 20, 30],
 *   look: [ 0,  0,  0],
 *   up:   [ 0,  1,  0]
 * });
 * ```
 *
 * <br>
 *
 * ### 4) Switch projection during the fly
 *
 * ```javascript
 * flight.flyTo({
 *   aabb:       sceneModel.aabb,
 *   projection: "ortho",                      // flip to orthographic at the end
 *   duration:   1.5
 * });
 * ```
 *
 * <br>
 *
 * ### 5) Play a recorded path
 *
 * ```javascript
 * const path = new CameraPath();
 * path.addFrame({ t: 0,   eye: [ 0, 5, 50], look: [0, 0, 0], up: [0, 1, 0] });
 * path.addFrame({ t: 2,   eye: [20, 5, 30], look: [0, 0, 0], up: [0, 1, 0] });
 * path.addFrame({ t: 4,   eye: [30, 5,  0], look: [0, 0, 0], up: [0, 1, 0] });
 *
 * const tour = new CameraPathAnimation(view, path);
 * tour.play();
 * ```
 *
 * <br>
 *
 * ### 6) Save and restore a path
 *
 * ```javascript
 * const json = path.saveToJSON();
 *
 * // …persist / fetch json elsewhere…
 *
 * const restored = new CameraPath();
 * restored.loadFromJSON(json);
 * ```
 *
 * @module cameraFlight
 */
export * from './CameraFlightAnimation';
export * from './CameraPath';
export * from './CameraPathAnimation';
