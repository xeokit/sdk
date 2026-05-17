/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="https://xeokit.github.io/sdk/docs/assets/example_cityJSON.png"/>
 *
 * # xeokit View Controller
 *
 * ---
 *
 * **Mouse, touch, and keyboard controller for a
 * {@link viewing!viewer.View | View}'s
 * {@link viewing!viewer.Camera | Camera}. Three navigation modes
 * (orbit, first-person, plan-view), context-aware movement scaling,
 * pivot-about-pick, and per-event mouse / touch hooks.**
 *
 * ---
 *
 * The `viewController` module adds interactive camera navigation to a
 * View. One {@link ViewController} per View, configured with a
 * navigation mode and optional pick / key-map overrides.
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class ViewController {
 *       +view    : View
 *       +navMode : OrbitNav | FirstPersonNav | PlanViewNav
 *       +keyMap  : Record~action, KeyCode[]~
 *       +pick    : CameraControlPickFn
 *       +active  : boolean
 *       +onHover / onHoverEnter / onHoverOut / onHoverOff
 *       +onPicked / onPickedSurface / onPickedNothing
 *       +onDoublePicked / onDoublePickedSurface / onDoublePickedNothing
 *       +onRightClick
 *       +destroy()
 *     }
 *     class ViewControllerParams {
 *       +active?            : boolean
 *       +navMode?           : NavMode
 *       +keyMap?            : Record~action, KeyCode[]~
 *       +pick?              : CameraControlPickFn
 *       +constrainVertical? : boolean
 *       +smartPivot?        : SmartPivotSpec
 *     }
 *     class ViewControllerEvents {
 *       +onHover / onPicked / onDoublePicked / onRightClick
 *     }
 *     class View {
 *       <<viewer>>
 *     }
 *     class Camera {
 *       <<viewer>>
 *     }
 *     ViewController ..> ViewControllerParams : reads
 *     ViewController "1" *-- "1" ViewControllerEvents
 *     ViewController o-- View : controls Camera in
 *     View *-- Camera
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Three navigation modes** — `OrbitNavigationMode` (orbit
 *   around a focus point), `FirstPersonNavigationMode` (free WASD
 *   walking), `PlanViewNavigationMode` (top-down pan + zoom).
 *   Switch live via `viewController.navMode = ...`.
 * - **Pointer-following** — dynamic camera target tracking that
 *   responds to where the cursor is pointing.
 * - **Context-aware movement scaling** — speed bigger in open
 *   spaces, smaller in confined spaces; computed from the
 *   under-cursor depth so the user doesn't need to tune speed
 *   manually.
 * - **Pivot-about-pick** — orbit around the picked world point
 *   instead of a global origin, so rotating around a detail keeps
 *   the detail centred.
 * - **Axis-aligned-view shortcuts** — `KEY_NUM_1` … `KEY_NUM_6`
 *   snap to top / bottom / front / back / left / right views.
 * - **Per-event hooks** — `onHover`, `onPicked`,
 *   `onDoublePicked`, `onRightClick`, with `onHoverEnter` /
 *   `onHoverOut` for transition-only handlers.
 * - **Configurable key map** — `QWERTYLayout` (default) and
 *   `AZERTYLayout` ship; arbitrary remaps via the `keyMap`
 *   parameter on construction or live mutation afterwards.
 * - **Vertical constraint** — `constrainVertical: true` clamps
 *   pitch to `[-90°, 90°]` so the camera never flips upside-down.
 *
 * <br>
 *
 * # Installation
 *
 * Install the package using npm:
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * # Usage
 *
 * This example demonstrates how to set up a {@link viewing!viewer.Viewer | Viewer} with a {@link viewing!webGLRenderer.WebGLRenderer | WebGLRenderer},
 * a {@link model!scene.Scene | Scene} to manage geometry and materials, and an interactive camera controlled via ViewController.
 *
 * ```javascript
 * import {SDKInternalException} from "@xeokit/sdk/base/core";
 * import {Scene} from "@xeokit/sdk/model/scene";
 * import {OrbitNavigationMode, FirstPersonNavigationMode, PlanViewNavigationMode, QWERTYLayout} from "@xeokit/sdk/base/constants";
 * import {WebGLRenderer} from "@xeokit/sdk/viewing/webGLRenderer";
 * import {Viewer} from "@xeokit/sdk/viewing/viewer";
 * import {ViewController, KEY_A, KEY_D, KEY_W, KEY_S} from "@xeokit/sdk/viewing/viewController";
 * import {CityJSONLoader} from "@xeokit/sdk/formats/cityjson";
 *
 * // Create a Scene to manage geometry and materials
 * const scene = new Scene();
 *
 * // Create a Viewer instance
 * const viewer = new Viewer({
 *     scene
 * });
 *
 * // Create a WebGLRenderer for rendering the Scene
 * const renderer = new WebGLRenderer({
 *    viewer
 * });
 *
 * // Create a View for rendering
 * const viewResult = viewer.createView({
 *     id: "myView",
 *     elementId: "myCanvas"
 * });
 *
 * const view = viewResult.value;
 *
 * // Configure the camera's initial position and orientation
 * view.camera.eye = [1841982.93, 10.03, -5173286.74];
 * view.camera.look = [1842009.49, 9.68, -5173295.85];
 * view.camera.up = [0.0, 1.0, 0.0];
 *
 * // Attach ViewController for interactive navigation
 * new ViewController(view, {});
 *
 * // Load a CityJSON model into the Scene
 * const sceneModelResult = scene.createModel({ id: "myModel" });
 *
 * const sceneModel = sceneModelResult.value;
 *
 * fetch("model.json").then(response => response.json()).then(fileData => {
 *     CityJSONLoader({ fileData, sceneModel }).then(() => {
 *         // Loaded
 *     });
 * });
 * ```
 *
 * <br>
 *
 * # Navigation Modes
 *
 * ViewController provides three main navigation modes:
 *
 * - **Orbit Mode**: Enables the camera to orbit around a target point.
 * - **First-Person Mode**: Allows free movement as if walking through the scene.
 * - **Plan-View Mode**: Maintains a top-down perspective while allowing panning and zooming.
 *
 * <br>
 *
 * ## Orbit Mode
 * To activate orbit mode:
 *
 * ```javascript
 * viewController.navMode = OrbitNavigationMode;
 * ```
 *
 * - **Orbit**: Left-drag the mouse, tap-drag on a touchpad, or use arrow keys.
 * - **Dolly (Zoom)**: Scroll the mouse wheel, pinch on a touchpad, or press `+` and `-`.
 * - **Pan**: Right-drag the mouse or use `SHIFT` while left-dragging.
 *
 * <br>
 *
 * ## First-Person Mode
 * Enables camera movement similar to a first-person video game.
 *
 * ```javascript
 * viewController.navMode = FirstPersonNavigationMode;
 * ```
 *
 * - **Rotate**: Left-drag the mouse or use arrow keys.
 * - **Move Forward/Backward**: Use `W` and `S` (QWERTY) or `Z` and `S` (AZERTY).
 * - **Strafe Left/Right**: Use `A` and `D`.
 *
 * <br>
 *
 * ## Plan-View Mode
 * Keeps the camera locked to a top-down perspective.
 *
 * ```javascript
 * viewController.navMode = PlanViewNavigationMode;
 * ```
 *
 * - **Pan**: Drag the mouse or use keyboard keys (`W`, `A`, `S`, `D`).
 * - **Zoom**: Scroll the mouse wheel or pinch on a touchpad.
 *
 * <br>
 *
 * # ViewController Events
 *
 * `ViewController` triggers events when interacting with {@link viewing!viewer.ViewObject | ViewObjects} using a mouse or touch input.
 *
 * <br>
 *
 * ## Usage
 *
 * To subscribe to an event:
 *
 * ```javascript
 * const onHoverSub = viewController.onHover.sub(e => {
 *     console.log(e.viewObject, e.canvasPos);
 * });
 * ```
 *
 * To unsubscribe:
 *
 * ```javascript
 * viewController.onHover.unsub(onHoverSub);
 * ```
 *
 * <br>
 *
 * ## Event List
 *
 * ### **Hover Events**
 *
 * - **`"hover"`** – Fired when the pointer moves over an entity.
 * - **`"hoverOff"`** – Fired when the pointer moves over empty space.
 * - **`"hoverEnter"`** – Fired when the pointer enters an entity.
 * - **`"hoverOut"`** – Fired when the pointer leaves an entity.
 *
 * ```javascript
 * viewController.onHoverEnter.sub(e => console.log(e.viewObject, e.canvasPos));
 * ```
 *
 * ### **Click & Tap Events**
 *
 * - **`"picked"`** – Fired on left-click/tap on an entity.
 * - **`"pickedSurface"`** – Fired on left-click/tap on an entity's surface.
 * - **`"pickedNothing"`** – Fired on left-click/tap on empty space.
 *
 * ```javascript
 * viewController.onPicked.sub(e => console.log(e.entity, e.canvasPos));
 * ```
 *
 * ### **Double Click & Tap Events**
 *
 * - **`"doublePicked"`** – Fired on double-click/tap on an entity.
 * - **`"doublePickedSurface"`** – Fired on double-click/tap on an entity's surface.
 * - **`"doublePickedNothing"`** – Fired on double-click/tap on empty space.
 *
 * ```javascript
 * viewController.onDoublePicked.sub(e => console.log(e.entity, e.canvasPos));
 * ```
 *
 * ### **Right Click Event**
 *
 * - **`"rightClick"`** – Fired on right-click anywhere on the canvas.
 *
 * ```javascript
 * viewController.onRightClick.sub(e => console.log(e.event, e.canvasPos));
 * ```
 *
 * <br>
 *
 * # Custom Keyboard Mappings
 *
 * The default key mappings can be overridden to fit specific layouts.
 *
 * ```javascript
 * viewController.keyMap = QWERTYLayout; // Or set to AZERTYLayout if needed.
 * ```
 *
 * Alternatively, define custom mappings:
 *
 * ```javascript
 * const keyMap = {};
 *
 * keyMap[viewController.PAN_LEFT] = [KEY_A];
 * keyMap[viewController.PAN_RIGHT] = [KEY_D];
 * keyMap[viewController.PAN_UP] = [KEY_Z];
 * keyMap[viewController.PAN_DOWN] = [KEY_X];
 * keyMap[viewController.DOLLY_FORWARDS] = [KEY_W, KEY_ADD];
 * keyMap[viewController.DOLLY_BACKWARDS] = [KEY_S, KEY_SUBTRACT];
 * keyMap[viewController.ROTATE_X_POS] = [KEY_DOWN_ARROW];
 * keyMap[viewController.ROTATE_X_NEG] = [KEY_UP_ARROW];
 * keyMap[viewController.ROTATE_Y_POS] = [KEY_LEFT_ARROW];
 * keyMap[viewController.ROTATE_Y_NEG] = [KEY_RIGHT_ARROW];
 * keyMap[viewController.AXIS_VIEW_RIGHT] = [KEY_NUM_1];
 * keyMap[viewController.AXIS_VIEW_BACK] = [KEY_NUM_2];
 * keyMap[viewController.AXIS_VIEW_LEFT] = [KEY_NUM_3];
 * keyMap[viewController.AXIS_VIEW_FRONT] = [KEY_NUM_4];
 * keyMap[viewController.AXIS_VIEW_TOP] = [KEY_NUM_5];
 * keyMap[viewController.AXIS_VIEW_BOTTOM] = [KEY_NUM_6];
 *
 * viewController.keyMap = keyMap;
 * ```
 *
 * <br>
 *
 * @module viewController
 */
export * from "./ViewController";
export {ViewControllerEvents} from "./ViewControllerEvents";
export type {ViewControllerParams, CameraControlPickFn} from "./ViewControllerParams";
export * from "./keycodes";
