/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="https://xeokit.github.io/sdk/docs/assets/example_cityJSON.png"/>
 *
 * ---
 * **Mouse and touch controller for a Viewer's Camera**
 * ---
 *
 * <br>
 *
 * # Overview
 *
 * The {@link cameracontrol!CameraControl | CameraControl} class provides an interactive way to navigate a
 * {@link viewer!View | View's} {@link viewer!Camera | Camera} through various input methods, including mouse, touch, and keyboard.
 *
 * This controller supports multiple navigation modes: orbit, first-person, and plan-view. These modes allow
 * users to control the camera movement dynamically and intuitively, catering to different use cases and preferences.
 *
 * Features include:
 * - **Pointer-following** for dynamically adjusting the camera's target.
 * - **Context-aware movement scaling** to move quickly in open spaces and slowly in confined spaces.
 * - **Pivot-about-point** to orbit picked surface positions.
 * - **Axis-aligned views** for precise positioning.
 * - **Configurable behaviors** like vertical movement constraints and double-click object focusing.
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
 * This example demonstrates how to set up a {@link viewer!Viewer | Viewer} with a {@link webglrenderer!WebGLRenderer | WebGLRenderer},
 * a {@link scene!Scene | Scene} to manage geometry and materials, and an interactive camera controlled via CameraControl.
 *
 * ```javascript
 * import {SDKError} from "@xeokit/sdk/core";
 * import {Scene} from "@xeokit/sdk/scene";
 * import {OrbitNavigationMode, FirstPersonNavigationMode, PlanViewNavigationMode, QWERTYLayout} from "@xeokit/sdk/constants";
 * import {WebGLRenderer} from "@xeokit/sdk/webglrenderer";
 * import {Viewer} from "@xeokit/sdk/viewer";
 * import {CameraControl, KEY_A, KEY_D, KEY_W, KEY_S} from "@xeokit/sdk/cameracontrol";
 * import {loadCityJSON} from "@xeokit/sdk/cityjson";
 *
 * // Create a Scene to manage geometry and materials
 * const scene = new Scene();
 *
 * // Create a WebGLRenderer for rendering the Scene
 * const renderer = new WebGLRenderer({});
 *
 * // Create a Viewer instance
 * const viewer = new Viewer({
 *     id: "viewer",
 *     scene,
 *     renderer
 * });
 *
 * // Create a View for rendering
 * const view = viewer.createView({
 *     id: "myView",
 *     elementId: "myCanvas"
 * });
 *
 * // Configure the camera's initial position and orientation
 * view.camera.eye = [1841982.93, 10.03, -5173286.74];
 * view.camera.look = [1842009.49, 9.68, -5173295.85];
 * view.camera.up = [0.0, 1.0, 0.0];
 *
 * // Attach CameraControl for interactive navigation
 * new CameraControl(view, {});
 *
 * // Load a CityJSON model into the Scene
 * const sceneModel = scene.createModel({ id: "myModel" });
 * fetch("model.json").then(response => response.json()).then(fileData => {
 *     loadCityJSON({ fileData, sceneModel }).then(() => {
 *         sceneModel.build();
 *     });
 * });
 * ```
 *
 * <br>
 *
 * # Navigation Modes
 *
 * CameraControl provides three main navigation modes:
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
 * cameraControl.navMode = OrbitNavigationMode;
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
 * cameraControl.navMode = FirstPersonNavigationMode;
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
 * cameraControl.navMode = PlanViewNavigationMode;
 * ```
 *
 * - **Pan**: Drag the mouse or use keyboard keys (`W`, `A`, `S`, `D`).
 * - **Zoom**: Scroll the mouse wheel or pinch on a touchpad.
 *
 * <br>
 *
 * # CameraControl Events
 *
 * `CameraControl` triggers events when interacting with {@link viewer!ViewObject | ViewObjects} using a mouse or touch input.
 *
 * <br>
 *
 * ## Usage
 *
 * To subscribe to an event:
 *
 * ```javascript
 * const onHoverSub = cameraControl.onHover.sub(e => {
 *     console.log(e.viewObject, e.canvasPos);
 * });
 * ```
 *
 * To unsubscribe:
 *
 * ```javascript
 * cameraControl.onHover.unsub(onHoverSub);
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
 * cameraControl.onHoverEnter.sub(e => console.log(e.viewObject, e.canvasPos));
 * ```
 *
 * ### **Click & Tap Events**
 *
 * - **`"picked"`** – Fired on left-click/tap on an entity.
 * - **`"pickedSurface"`** – Fired on left-click/tap on an entity's surface.
 * - **`"pickedNothing"`** – Fired on left-click/tap on empty space.
 *
 * ```javascript
 * cameraControl.onPicked.sub(e => console.log(e.entity, e.canvasPos));
 * ```
 *
 * ### **Double Click & Tap Events**
 *
 * - **`"doublePicked"`** – Fired on double-click/tap on an entity.
 * - **`"doublePickedSurface"`** – Fired on double-click/tap on an entity's surface.
 * - **`"doublePickedNothing"`** – Fired on double-click/tap on empty space.
 *
 * ```javascript
 * cameraControl.onDoublePicked.sub(e => console.log(e.entity, e.canvasPos));
 * ```
 *
 * ### **Right Click Event**
 *
 * - **`"rightClick"`** – Fired on right-click anywhere on the canvas.
 *
 * ```javascript
 * cameraControl.onRightClick.sub(e => console.log(e.event, e.canvasPos));
 * ```
 *
 * <br>
 *
 * # Custom Keyboard Mappings
 *
 * The default key mappings can be overridden to fit specific layouts.
 *
 * ```javascript
 * cameraControl.keyMap = QWERTYLayout; // Or set to AZERTYLayout if needed.
 * ```
 *
 * Alternatively, define custom mappings:
 *
 * ```javascript
 * const keyMap = {};
 *
 * keyMap[cameraControl.PAN_LEFT] = [KEY_A];
 * keyMap[cameraControl.PAN_RIGHT] = [KEY_D];
 * keyMap[cameraControl.PAN_UP] = [KEY_Z];
 * keyMap[cameraControl.PAN_DOWN] = [KEY_X];
 * keyMap[cameraControl.DOLLY_FORWARDS] = [KEY_W, KEY_ADD];
 * keyMap[cameraControl.DOLLY_BACKWARDS] = [KEY_S, KEY_SUBTRACT];
 * keyMap[cameraControl.ROTATE_X_POS] = [KEY_DOWN_ARROW];
 * keyMap[cameraControl.ROTATE_X_NEG] = [KEY_UP_ARROW];
 * keyMap[cameraControl.ROTATE_Y_POS] = [KEY_LEFT_ARROW];
 * keyMap[cameraControl.ROTATE_Y_NEG] = [KEY_RIGHT_ARROW];
 * keyMap[cameraControl.AXIS_VIEW_RIGHT] = [KEY_NUM_1];
 * keyMap[cameraControl.AXIS_VIEW_BACK] = [KEY_NUM_2];
 * keyMap[cameraControl.AXIS_VIEW_LEFT] = [KEY_NUM_3];
 * keyMap[cameraControl.AXIS_VIEW_FRONT] = [KEY_NUM_4];
 * keyMap[cameraControl.AXIS_VIEW_TOP] = [KEY_NUM_5];
 * keyMap[cameraControl.AXIS_VIEW_BOTTOM] = [KEY_NUM_6];
 *
 * cameraControl.keyMap = keyMap;
 * ```
 *
 * <br>
 *
 * @module cameracontrol
 */
export * from "./CameraControl";
export type { CameraControlParams } from "./CameraControlParams";
export * from "./keycodes";
