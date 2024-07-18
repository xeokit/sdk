
import {CameraFlightAnimation, PickResult, View} from "@xeokit/viewer";
import {createVec2} from "@xeokit/matrix";
import {PickController} from "./PickController";
import {PivotController} from "./PivotController";
import {PanController} from "./PanController";
import {Component, EventEmitter} from "@xeokit/core";
import {MouseMiscHandler} from "./MouseMiscHandler";
import {TouchPanRotateAndDollyHandler} from "./TouchPanRotateAndDollyHandler";
import {MousePanRotateDollyHandler} from "./MousePanRotateDollyHandler";
import {KeyboardAxisViewHandler} from "./KeyboardAxisViewHandler";
import {MousePickHandler} from "./MousePickHandler";
import {TouchPickHandler} from "./TouchPickHandler";
import {KeyboardPanRotateDollyHandler} from "./KeyboardPanRotateDollyHandler";
import {CameraUpdater} from "./CameraUpdater";
import {isString} from "@xeokit/utils";
import {FirstPersonNavigationMode, OrbitNavigationMode, PlanViewNavigationMode} from "@xeokit/constants";
import {EventDispatcher} from "strongly-typed-events";
import {
    KEY_A,
    KEY_ADD,
    KEY_D,
    KEY_DOWN_ARROW,
    KEY_E,
    KEY_LEFT_ARROW,
    KEY_NUM_1,
    KEY_NUM_2,
    KEY_NUM_3,
    KEY_NUM_4,
    KEY_NUM_5,
    KEY_NUM_6,
    KEY_Q,
    KEY_RIGHT_ARROW,
    KEY_S,
    KEY_SUBTRACT,
    KEY_UP_ARROW,
    KEY_W,
    KEY_X,
    KEY_Z
} from "./keycodes";



const DEFAULT_SNAP_PICK_RADIUS = 30;
const DEFAULT_SNAP_VERTEX = true;
const DEFAULT_SNAP_EDGE = true;

/**
 *
 */
class HoverEvent {
}

/**
 *
 */
export interface CameraControlParams {
    mouseWheelDollyRate?: number;
    keyboardDollyRate?: number;
    panInertia?: number;
    dollyMinSpeed?: number;
    dollyProximityThreshold?: number;
    dollyInertia?: number;
    touchDollyRate?: number;
    dragRotationRate?: number;
    keyboardRotationRate?: number;
    touchPanRate?: number;
    keyboardPanRate?: number;
    rotationInertia?: number;
    followPointer?: boolean;
    active?: boolean;
    panRightClick?: boolean;
    keyMap?: any;
    keyboardLayout?: any;
    constrainVertical?: boolean;
    planView?: boolean;
    navMode?: number;
    doublePickFlyTo?: boolean;
    keyboardEnabled?: boolean;
}

/**
 * @desc Controls the {@link Camera} with user input, and fires events when the user interacts with pickable {@link Entity}s.
 *
 * # Contents
 *
 * * [Overview](#overview)
 * * [Examples](#examples)
 * * [Orbit Mode](#orbit-mode)
 *      + [Following the Pointer in Orbit Mode](#--following-the-pointer-in-orbit-mode--)
 *      + [Showing the Pivot Position](#--showing-the-pivot-position--)
 *      + [Axis-Aligned Views in Orbit Mode](#--axis-aligned-views-in-orbit-mode--)
 *      + [View-Fitting Entitys in Orbit Mode](#--view-fitting-entitys-in-orbit-mode--)
 * * [First-Person Mode](#first-person-mode)
 *      + [Following the Pointer in First-Person Mode](#--following-the-pointer-in-first-person-mode--)
 *      + [Constraining Vertical Position in First-Person Mode](#--constraining-vertical-position-in-first-person-mode--)
 *      + [Axis-Aligned Views in First-Person Mode](#--axis-aligned-views-in-first-person-mode--)
 *      + [View-Fitting Entitys in First-Person Mode](#--view-fitting-entitys-in-first-person-mode--)
 * * [Plan-View Mode](#plan-view-mode)
 *      + [Following the Pointer in Plan-View Mode](#--following-the-pointer-in-plan-view-mode--)
 *      + [Axis-Aligned Views in Plan-View Mode](#--axis-aligned-views-in-plan-view-mode--)
 * * [CameraControl Events](#cameracontrol-events)
 *      + ["hover"](#---hover---)
 *      + ["hoverOff"](#---hoveroff---)
 *      + ["hoverEnter"](#---hoverenter---)
 *      + ["hoverOut"](#---hoverout---)
 *      + ["picked"](#---picked---)
 *      + ["pickedSurface"](#---pickedsurface---)
 *      + ["pickedNothing"](#---pickednothing---)
 *      + ["doublePicked"](#---doublepicked---)
 *      + ["doublePickedSurface"](#---doublepickedsurface---)
 *      + ["doublePickedNothing"](#---doublepickednothing---)
 *      + ["rightClick"](#---rightclick---)
 * * [Custom Keyboard Mappings](#custom-keyboard-mappings)
 *
 * <br><br>
 *
 * # Overview
 *
 * * Each {@link Viewer} has a ````CameraControl````, located at {@link Viewer#cameraControl}.
 * * {@link CameraControl#navMode} selects the navigation mode:
 *      * ````OrbitNavigationMode```` rotates the {@link Camera} position about the target.
 *      * ````"firstPerson"```` rotates the World about the Camera position.
 *      * ````"planView"```` never rotates, but still allows to pan and dolly, typically for an axis-aligned view.
 * * {@link CameraControl#followPointer} makes the Camera follow the mouse or touch pointer.
 * * {@link CameraControl#constrainVertical} locks the Camera to its current height when in first-person mode.
 * * ````CameraControl```` fires pick events when we hover, click or tap on an {@link Entity}.
 * <br><br>
 *
 * # Examples
 *
 * * [Orbit Navigation - Duplex Model](https://xeokit.github.io/xeokit-sdk/examples/index.html#CameraControl_orbit_Duplex)
 * * [Orbit Navigation - Holter Tower Model](https://xeokit.github.io/xeokit-sdk/examples/index.html#CameraControl_orbit_HolterTower)
 * * [First-Person Navigation - Duplex Model](https://xeokit.github.io/xeokit-sdk/examples/index.html#CameraControl_firstPerson_Duplex)
 * * [First-Person Navigation - Holter Tower Model](https://xeokit.github.io/xeokit-sdk/examples/index.html#CameraControl_firstPerson_HolterTower)
 * * [Plan-view Navigation - Schependomlaan Model](https://xeokit.github.io/xeokit-sdk/examples/index.html#CameraControl_planView_Schependomlaan)
 * * [Custom Keyboard Mapping](https://xeokit.github.io/xeokit-sdk/examples/index.html#CameraControl_keyMap)
 * <br><br>
 *
 * # Orbit Mode
 *
 * In orbit mode, ````CameraControl```` orbits the {@link Camera} about the target.
 *
 * To enable orbit mode:
 *
 * ````javascript
 * const cameraControl = myViewer.cameraControl;
 * cameraControl.navMode = OrbitNavigationMode;
 * ````
 *
 * Then orbit by:
 *
 * * left-dragging the mouse,
 * * tap-dragging the touch pad, and
 * * pressing arrow keys, or ````Q```` and ````E```` on a QWERTY keyboard, or ````A```` and ````E```` on an AZERTY keyboard.
 * <br><br>
 *
 * Dolly forwards and backwards by:
 *
 * * spinning the mouse wheel,
 * * pinching on the touch pad, and
 * * pressing the ````+```` and ````-```` keys, or ````W```` and ````S```` on a QWERTY keyboard, or ````Z```` and ````S```` for AZERTY.
 * <br><br>
 *
 * Pan horizontally and vertically by:
 *
 * * right-dragging the mouse,
 * * left-dragging the mouse with the SHIFT key down,
 * * tap-dragging the touch pad with SHIFT down,
 * * pressing the ````A````, ````D````, ````Z```` and ````X```` keys on a QWERTY keyboard, and
 * * pressing the ````Q````, ````D````, ````W```` and ````X```` keys on an AZERTY keyboard,
 * <br><br>
 *
 * ## Following the Pointer in Orbit Mode
 *
 * When {@link CameraControl#followPointer} is ````true````in orbiting mode, the mouse or touch pointer will dynamically
 * indicate the target that the {@link Camera} will orbit, as well as dolly to and from.
 *
 * Lets ensure that we're in orbit mode, then enable the {@link Camera} to follow the pointer:
 *
 * ````javascript
 * cameraControl.navMode = OrbitNavigationMode;
 * cameraControl.followPointer = true;
 * ````
 *
 * ## Smart Pivoting
 *
 * TODO
 *
 * ## Showing the Pivot Position
 *
 * We can configure {@link CameraControl#pivotElement} with an HTML element to indicate the current
 * pivot position. The indicator will appear momentarily each time we move the {@link Camera} while in orbit mode with
 * {@link CameraControl#followPointer} set ````true````.
 *
 * First we'll define some CSS to style our pivot indicator as a black dot with a white border:
 *
 * ````css
 * .camera-pivot-marker {
 *      color: #ffffff;
 *      position: absolute;
 *      width: 25px;
 *      height: 25px;
 *      border-radius: 15px;
 *      border: 2px solid #ebebeb;
 *      background: black;
 *      visibility: hidden;
 *      box-shadow: 5px 5px 15px 1px #000000;
 *      z-index: 10000;
 *      pointer-events: none;
 * }
 * ````
 *
 * Then we'll attach our pivot indicator's HTML element to the ````CameraControl````:
 *
 * ````javascript
 * const pivotElement = document.createRange().createContextualFragment("<div class='camera-pivot-marker'></div>").firstChild;
 *
 * document.body.appendChild(pivotElement);
 *
 * cameraControl.pivotElement = pivotElement;
 * ````
 *
 * ## Axis-Aligned Views in Orbit Mode
 *
 * In orbit mode, we can use keys 1-6 to position the {@link Camera} to look at the center of the {@link Scene} from along each of the
 * six World-space axis. Pressing one of these keys will fly the {@link Camera} to the corresponding axis-aligned view.
 *
 * ## View-Fitting Entitys in Orbit Mode
 *
 * When {@link CameraControl#doublePickFlyTo} is ````true````, we can left-double-click or
 * double-tap (ie. "double-pick") an {@link Entity} to fit it to view. This will cause the {@link Camera}
 * to fly to that Entity. Our target then becomes the center of that Entity. If we are currently pivoting,
 * then our pivot position is then also set to the Entity center.
 *
 * Disable that behaviour by setting {@link CameraControl#doublePickFlyTo} ````false````.
 *
 * # First-Person Mode
 *
 * In first-person mode, ````CameraControl```` rotates the World about the {@link Camera} position.
 *
 * To enable first-person mode:
 *
 * ````javascript
 * cameraControl.navMode = "firstPerson";
 * ````
 *
 * Then rotate by:
 *
 * * left-dragging the mouse,
 * * tap-dragging the touch pad,
 * * pressing arrow keys, or ````Q```` and ````E```` on a QWERTY keyboard, or ````A```` and ````E```` on an AZERTY keyboard.
 * <br><br>
 *
 * Dolly forwards and backwards by:
 *
 * * spinning the mouse wheel,
 * * pinching on the touch pad, and
 * * pressing the ````+```` and ````-```` keys, or ````W```` and ````S```` on a QWERTY keyboard, or ````Z```` and ````S```` for AZERTY.
 * <br><br>
 *
 * Pan left, right, up and down by:
 *
 * * left-dragging or right-dragging the mouse, and
 * * tap-dragging the touch pad with SHIFT down.
 *
 * Pan forwards, backwards, left, right, up and down by pressing the ````WSADZX```` keys on a QWERTY keyboard,
 * or ````WSQDWX```` keys on an AZERTY keyboard.
 * <br><br>
 *
 * ## Following the Pointer in First-Person Mode
 *
 * When {@link CameraControl#followPointer} is ````true```` in first-person mode, the mouse or touch pointer will dynamically
 * indicate the target to which the {@link Camera} will dolly to and from. In first-person mode, however, the World will always rotate
 * about the {@link Camera} position.
 *
 * Lets ensure that we're in first-person mode, then enable the {@link Camera} to follow the pointer:
 *
 * ````javascript
 * cameraControl.navMode = "firstPerson";
 * cameraControl.followPointer = true;
 * ````
 *
 * When the pointer is over empty space, the target will remain the last object that the pointer was over.
 *
 * ## Constraining Vertical Position in First-Person Mode
 *
 * In first-person mode, we can lock the {@link Camera} to its current position on the vertical World axis, which is useful for walk-through navigation:
 *
 * ````javascript
 * cameraControl.constrainVertical = true;
 * ````
 *
 * ## Axis-Aligned Views in First-Person Mode
 *
 * In first-person mode we can use keys 1-6 to position the {@link Camera} to look at the center of
 * the {@link Scene} from along each of the six World-space axis. Pressing one of these keys will fly the {@link Camera} to the
 * corresponding axis-aligned view.
 *
 * ## View-Fitting Entitys in First-Person Mode
 *
 * As in orbit mode, when in first-person mode and {@link CameraControl#doublePickFlyTo} is ````true````, we can double-click
 * or double-tap an {@link Entity} (ie. "double-picking") to fit it in view. This will cause the {@link Camera} to fly to
 * that Entity. Our target then becomes the center of that Entity.
 *
 * Disable that behaviour by setting {@link CameraControl#doublePickFlyTo} ````false````.
 *
 * # Plan-View Mode
 *
 * In plan-view mode, ````CameraControl```` pans and rotates the {@link Camera}, without rotating it.
 *
 * To enable plan-view mode:
 *
 * ````javascript
 * cameraControl.navMode = "planView";
 * ````
 *
 * Dolly forwards and backwards by:
 *
 * * spinning the mouse wheel,
 * * pinching on the touch pad, and
 * * pressing the ````+```` and ````-```` keys.
 *
 * <br>
 * Pan left, right, up and down by:
 *
 * * left-dragging or right-dragging the mouse, and
 * * tap-dragging the touch pad with SHIFT down.
 *
 * Pan forwards, backwards, left, right, up and down by pressing the ````WSADZX```` keys on a QWERTY keyboard,
 * or ````WSQDWX```` keys on an AZERTY keyboard.
 * <br><br>
 *
 * ## Following the Pointer in Plan-View Mode
 *
 * When {@link CameraControl#followPointer} is ````true```` in plan-view mode, the mouse or touch pointer will dynamically
 * indicate the target to which the {@link Camera} will dolly to and from.  In plan-view mode, however, the {@link Camera} cannot rotate.
 *
 * Lets ensure that we're in plan-view mode, then enable the {@link Camera} to follow the pointer:
 *
 * ````javascript
 * cameraControl.navMode = "planView";
 * cameraControl.followPointer = true; // Default
 * ````
 *
 * When the pointer is over empty space, the target will remain the last object that the pointer was over.
 *
 * ## Axis-Aligned Views in Plan-View Mode
 *
 * As in orbit and first-person modes, in plan-view mode we can use keys 1-6 to position the {@link Camera} to look at the center of
 * the {@link Scene} from along each of the six World-space axis. Pressing one of these keys will fly the {@link Camera} to the
 * corresponding axis-aligned view.
 *
 * # CameraControl Events
 *
 * ````CameraControl```` fires events as we interact with {@link Entity}s using mouse or touch input.
 *
 * The following examples demonstrate how to subscribe to those events.
 *
 * The first example shows how to save a handle to a subscription, which we can later use to unsubscribe.
 *
 * ## "hover"
 *
 * Event fired when the pointer moves while hovering over an Entity.
 *
 * ````javascript
 * const onHover = cameraControl.on("hover", (e) => {
 *      const entity = e.entity; // Entity
 *      const canvasPos = e.canvasPos; // 2D canvas position
 * });
 * ````
 *
 * To unsubscribe from the event:
 *
 * ````javascript
 * cameraControl.off(onHover);
 * ````
 *
 * ## "hoverOff"
 *
 * Event fired when the pointer moves while hovering over empty space.
 *
 * ````javascript
 * cameraControl.on("hoverOff", (e) => {
 *      const canvasPos = e.canvasPos;
 * });
 * ````
 *
 * ## "hoverEnter"
 *
 * Event fired when the pointer moves onto an Entity.
 *
 * ````javascript
 * cameraControl.on("hoverEnter", (e) => {
 *      const entity = e.entity;
 *      const canvasPos = e.canvasPos;
 * });
 * ````
 *
 * ## "hoverOut"
 *
 * Event fired when the pointer moves off an Entity.
 *
 * ````javascript
 * cameraControl.on("hoverOut", (e) => {
 *      const entity = e.entity;
 *      const canvasPos = e.canvasPos;
 * });
 * ````
 *
 * ## "picked"
 *
 * Event fired when we left-click or tap on an Entity.
 *
 * ````javascript
 * cameraControl.on("picked", (e) => {
 *      const entity = e.entity;
 *      const canvasPos = e.canvasPos;
 * });
 * ````
 *
 * ## "pickedSurface"
 *
 * Event fired when we left-click or tap on the surface of an Entity.
 *
 * ````javascript
 * cameraControl.on("picked", (e) => {
 *      const entity = e.entity;
 *      const canvasPos = e.canvasPos;
 *      const worldPos = e.worldPos; // 3D World-space position
 *      const viewPos = e.viewPos; // 3D View-space position
 *      const worldNormal = e.worldNormal; // 3D World-space normal vector
 * });
 * ````
 *
 * ## "pickedNothing"
 *
 * Event fired when we left-click or tap on empty space.
 *
 * ````javascript
 * cameraControl.on("pickedNothing", (e) => {
 *      const canvasPos = e.canvasPos;
 * });
 * ````
 *
 * ## "doublePicked"
 *
 * Event fired wwhen we left-double-click or double-tap on an Entity.
 *
 * ````javascript
 * cameraControl.on("doublePicked", (e) => {
 *      const entity = e.entity;
 *      const canvasPos = e.canvasPos;
 * });
 * ````
 *
 * ## "doublePickedSurface"
 *
 * Event fired when we left-double-click or double-tap on the surface of an Entity.
 *
 * ````javascript
 * cameraControl.on("doublePickedSurface", (e) => {
 *      const entity = e.entity;
 *      const canvasPos = e.canvasPos;
 *      const worldPos = e.worldPos;
 *      const viewPos = e.viewPos;
 *      const worldNormal = e.worldNormal;
 * });
 * ````
 *
 * ## "doublePickedNothing"
 *
 * Event fired when we left-double-click or double-tap on empty space.
 *
 * ````javascript
 * cameraControl.on("doublePickedNothing", (e) => {
 *      const canvasPos = e.canvasPos;
 * });
 * ````
 *
 * ## "rightClick"
 *
 * Event fired when we right-click on the canvas.
 *
 * ````javascript
 * cameraControl.on("rightClick", (e) => {
 *      const event = e.event; // Mouse event
 *      const canvasPos = e.canvasPos;
 * });
 * ````
 *
 * ## Custom Keyboard Mappings
 *
 * We can customize````CameraControl```` key bindings as shown below.
 *
 * In this example, we'll just set the default bindings for a QWERTY keyboard.
 *
 * ````javascript
 * const input = myViewer.view.input;
 *
 * cameraControl.navMode = OrbitNavigationMode;
 * cameraControl.followPointer = true;
 *
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
 * ````
 *
 * We can also just configure default bindings for a specified keyboard layout, like this:
 *
 * ````javascript
 * cameraControl.keyMap = "qwerty";
 * ````
 *
 * Then, ````CameraControl```` will internally set {@link CameraControl#keyMap} to the default key map for the QWERTY
 * layout (which is the same set of mappings we set in the previous example). In other words, if we subsequently
 * read {@link CameraControl#keyMap}, it will now be a key map, instead of the "qwerty" string value we set it to.
 *
 * Supported layouts are, so far:
 *
 * * ````"qwerty"````
 * * ````"azerty"````
 */
export class CameraControl extends Component {

    /**
     * Identifies the XX action.
     * @final
     * @type {Number}
     */
    static PAN_LEFT = 0;

    /**
     * Identifies the XX action.
     * @final
     * @type {Number}
     */
    static PAN_RIGHT = 1;

    /**
     * Identifies the XX action.
     * @final
     * @type {Number}
     */
    static PAN_UP = 2;

    /**
     * Identifies the XX action.
     * @final
     * @type {Number}
     */
    static PAN_DOWN = 3;

    /**
     * Identifies the XX action.
     * @final
     * @type {Number}
     */
    static PAN_FORWARDS = 4;

    /**
     * Identifies the XX action.
     * @final
     * @type {Number}
     */
    static PAN_BACKWARDS = 5;

    /**
     * Identifies the XX action.
     * @final
     * @type {Number}
     */
    static ROTATE_X_POS = 6;

    /**
     * Identifies the XX action.
     * @final
     * @type {Number}
     */
    static ROTATE_X_NEG = 7;

    /**
     * Identifies the XX action.
     * @final
     * @type {Number}
     */
    static ROTATE_Y_POS = 8;

    /**
     * Identifies the XX action.
     * @final
     * @type {Number}
     */
    static ROTATE_Y_NEG = 9;

    /**
     * Identifies the XX action.
     * @final
     * @type {Number}
     */
    static DOLLY_FORWARDS = 10;

    /**
     * Identifies the XX action.
     * @final
     * @type {Number}
     */
    static DOLLY_BACKWARDS = 11;

    /**
     * Identifies the XX action.
     * @final
     * @type {Number}
     */
    static AXIS_VIEW_RIGHT = 12;

    /**
     * Identifies the XX action.
     * @final
     * @type {Number}
     */
    static AXIS_VIEW_BACK = 13;

    /**
     * Identifies the XX action.
     * @final
     * @type {Number}
     */
    static AXIS_VIEW_LEFT = 14;

    /**
     * Identifies the XX action.
     * @final
     * @type {Number}
     */
    static AXIS_VIEW_FRONT = 15;

    /**
     * Identifies the XX action.
     * @final
     * @type {Number}
     */
    static AXIS_VIEW_TOP = 16;

    /**
     * Identifies the XX action.
     * @final
     * @type {Number}
     */
    static AXIS_VIEW_BOTTOM = 17;

    view: View;


    /**
     * Event fired when we right-click.
     *
     * @event
     */
    readonly onRightClick: EventEmitter<CameraControl, any>;

    /**
     * Event fired when the pointer moves while over a {@link @xeokit/viewer!ViewObject}.
     *
     * @event
     */
    readonly onHover: EventEmitter<CameraControl, HoverEvent>;

    /**
     * Event fired when the pointer moves while over a {@link @xeokit/viewer!ViewObject}.
     *
     * @event
     */
    readonly onHoverSurface: EventEmitter<CameraControl, HoverEvent>;

    /**
     * Event fired when the pointer moves while over empty space.
     *
     * @event
     */
    readonly onHoverOff: EventEmitter<CameraControl, HoverEvent>;

    /**
     * Event fired when the pointer moves onto a {@link @xeokit/viewer!ViewObject}.
     *
     * @event
     */
    readonly onHoverEnter: EventEmitter<CameraControl, HoverEvent>;

    /**
     * Event fired when the pointer moves off a {@link @xeokit/viewer!ViewObject}.
     *
     * @event
     */
    readonly onHoverOut: EventEmitter<CameraControl, HoverEvent>;

    /**
     * Event fired when a {@link @xeokit/viewer!ViewObject} is picked.
     *
     * @event
     */
    readonly onPicked: EventEmitter<CameraControl, PickResult>;

    /**
     * Event fired when empty space is picked.
     *
     * @event
     */
    readonly onPickedSurface: EventEmitter<CameraControl, PickResult>;

    /**
     * Event fired when empty space is picked.
     *
     * @event
     */
    readonly onPickedNothing: EventEmitter<CameraControl, null>;

    /**
     * Event fired when a ViewObject is double-picked.
     *
     * @event
     */
    readonly onDoublePicked: EventEmitter<CameraControl, PickResult>;

    /**
     * Event fired when a surface is double-picked.
     *
     * @event
     */
    readonly onDoublePickedSurface: EventEmitter<CameraControl, PickResult>;

    /**
     * Event fired when empty space is double-picked.
     *
     * @event
     */
    readonly onDoublePickedNothing: EventEmitter<CameraControl, PickResult>;

    /**
     * Event fired when snapping off a surface, vertex, or edge.
     *
     * @event
     */
    readonly onHoverSnapOrSurfaceOff: EventEmitter<CameraControl, any>;

    /**
     * Event fired when snapping onto a surface, vertex, or edge.
     *
     * @event
     */
    readonly onHoverSnapOrSurface: EventEmitter<CameraControl, any>;

    /**
     * Event fired when ray moves.
     *
     * @event
     */
    readonly onRayMove: EventEmitter<CameraControl, any>;

    #configs: {
        rotationInertia: number;
        mouseWheelDollyRate: number;
        snapToEdge: boolean;
        keyboardPanRate: number;
        touchPanRate: number;
        pointerEnabled: boolean;
        dollyProximityThreshold: number;
        keyboardRotationRate: number;
        planView: boolean;
        doubleClickTimeFrame: number;
        keyboardLayout: string;
        constrainVertical: boolean;
        snapRadius: number;
        touchDollyRate: number;
        dragRotationRate: number;
        firstPerson: boolean;
        active: boolean;
        longTapRadius: number;
        dollyMinSpeed: number;
        panInertia: number;
        followPointer: boolean;
        showPivot: boolean;
        keyboardEnabledOnlyIfMouseover: boolean;
        navMode: number;
        longTapTimeout: number;
        snapToVertex: boolean;
        keyboardDollyRate: number;
        dollyInertia: number;
        panRightClick: boolean;
        smartPivot: boolean;
        doublePickFlyTo: boolean;
    };

    #states: {
        mouseDownCursorX: number;
        tapStartTime: number;
        lastTapTime: number;
        mouseover: boolean;
        mouseDownCursorY: number;
        pointerCanvasPos: any;
        activeTouches: any[];
        tapStartPos: any;
        longTouchTimeout: null;
        followPointerDirty: boolean;
        mouseDownClientX: number;
        mouseDownClientY: number;
        touchStartTime: null;
    };

    #updates: {
        panDeltaZ: number;
        panDeltaY: number;
        panDeltaX: number;
        rotateDeltaX: number;
        dollyDelta: number;
        rotateDeltaY: number;
    };

    #controllers: {
        pickController: any;
        cameraControl: any;
        pivotController: any;
        cameraFlight: any;
        panController: any;
    };

    #handlers: any[];
    #cameraUpdater: any;

    #keyMap: any;



    /**
     * @private
     * @constructor
     */
    constructor(view: View, cfg:CameraControlParams = {}) {

        super(view, cfg);

        this.#keyMap  = {}; // Maps key codes to the above actions

        this.view = view;

        this.view.htmlElement.oncontextmenu = (e) => {
            e.preventDefault();
        };

        // User-settable CameraControl configurations

        this.#configs = {

            // Private

            longTapTimeout: 600, // Millisecs
            longTapRadius: 5, // Pixels

            // General

            active: true,
            keyboardLayout: "qwerty",
            navMode: OrbitNavigationMode,
            planView: false,
            firstPerson: false,
            followPointer: true,
            doublePickFlyTo: true,
            panRightClick: true,
            showPivot: false,
            pointerEnabled: true,
            constrainVertical: false,
            smartPivot: false,
            doubleClickTimeFrame: 250,

            snapToVertex: DEFAULT_SNAP_VERTEX,
            snapToEdge: DEFAULT_SNAP_EDGE,
            snapRadius: DEFAULT_SNAP_PICK_RADIUS,

            keyboardEnabledOnlyIfMouseover: true,

            // Rotation

            dragRotationRate: 360.0,
            keyboardRotationRate: 90.0,
            rotationInertia: 0.0,

            // Panning

            keyboardPanRate: 1.0,
            touchPanRate: 1.0,
            panInertia: 0.5,

            // Dollying

            keyboardDollyRate: 10,
            mouseWheelDollyRate: 100,
            touchDollyRate: 0.2,
            dollyInertia: 0,
            dollyProximityThreshold: 30.0,
            dollyMinSpeed: 0.04
        };

        // Current runtime state of the CameraControl

        this.#states = {
            pointerCanvasPos: createVec2(),
            mouseover: false,
            followPointerDirty: true,
            mouseDownClientX: 0,
            mouseDownClientY: 0,
            mouseDownCursorX: 0,
            mouseDownCursorY: 0,
            touchStartTime: null,
            activeTouches: [],
            tapStartPos: createVec2(),
            tapStartTime: -1,
            lastTapTime: -1,
            longTouchTimeout: null
        };

        // Updates for CameraUpdater to process on next Scene "tick" event

        this.#updates = {
            rotateDeltaX: 0,
            rotateDeltaY: 0,
            panDeltaX: 0,
            panDeltaY: 0,
            panDeltaZ: 0,
            dollyDelta: 0
        };

        // Controllers to assist input event handlers with controlling the Camera

        this.#controllers = {
            cameraControl: this,
            pickController: new PickController(this, this.#configs),
            pivotController: new PivotController(view, this.#configs),
            panController: new PanController(view),
            cameraFlight: new CameraFlightAnimation(this.view, {
                duration: 0.5
            })
        };

        // Input event handlers

        this.#handlers = [
            new MouseMiscHandler(this.view, this.#controllers, this.#configs, this.#states, this.#updates),
            new TouchPanRotateAndDollyHandler(this.view, this.#controllers, this.#configs, this.#states, this.#updates),
            new MousePanRotateDollyHandler(this.view, this.#controllers, this.#configs, this.#states, this.#updates),
            new KeyboardAxisViewHandler(this.view, this.#controllers, this.#configs, this.#states, this.#updates),
            new MousePickHandler(this.view, this.#controllers, this.#configs, this.#states, this.#updates),
            new TouchPickHandler(this.view, this.#controllers, this.#configs, this.#states, this.#updates),
            new KeyboardPanRotateDollyHandler(this.view, this.#controllers, this.#configs, this.#states, this.#updates)
        ];

        // Applies scheduled updates to the Camera on each Scene "tick" event

        this.#cameraUpdater = new CameraUpdater(this.view, this.#controllers, this.#configs, this.#states, this.#updates);

        this.onHover = new EventEmitter(new EventDispatcher<CameraControl, HoverEvent>());
        this.onHoverOff = new EventEmitter(new EventDispatcher<CameraControl, HoverEvent>());
        this.onHoverEnter = new EventEmitter(new EventDispatcher<CameraControl, HoverEvent>());
        this.onHoverOut = new EventEmitter(new EventDispatcher<CameraControl, HoverEvent>());

        this.onRightClick = new EventEmitter(new EventDispatcher<CameraControl, any>());
        this.onHoverSurface = new EventEmitter(new EventDispatcher<CameraControl, HoverEvent>());
        this.onPicked = new EventEmitter(new EventDispatcher<CameraControl, PickResult>());
        this.onPickedSurface = new EventEmitter(new EventDispatcher<CameraControl, PickResult>());
        this.onPickedNothing = new EventEmitter(new EventDispatcher<CameraControl, any>());
        this.onDoublePicked = new EventEmitter(new EventDispatcher<CameraControl, PickResult>());
        this.onDoublePickedSurface = new EventEmitter(new EventDispatcher<CameraControl, PickResult>());
        this.onDoublePickedNothing = new EventEmitter(new EventDispatcher<CameraControl, PickResult>());
        this.onHoverSnapOrSurfaceOff = new EventEmitter(new EventDispatcher<CameraControl, any>());
        this.onHoverSnapOrSurface = new EventEmitter(new EventDispatcher<CameraControl, any>());
        this.onRayMove = new EventEmitter(new EventDispatcher<CameraControl, any>());

        // Set initial user configurations

        this.navMode = cfg.navMode;
        if (cfg.planView) {
            this.planView = cfg.planView;
        }
        this.constrainVertical = cfg.constrainVertical;
        if (cfg.keyboardLayout) {
            this.keyboardLayout = cfg.keyboardLayout; // Deprecated
        } else {
            this.keyMap = cfg.keyMap;
        }
        this.doublePickFlyTo = cfg.doublePickFlyTo;
        this.panRightClick = cfg.panRightClick;
        this.active = cfg.active;
        this.followPointer = cfg.followPointer;
        this.rotationInertia = cfg.rotationInertia;
        this.keyboardPanRate = cfg.keyboardPanRate;
        this.touchPanRate = cfg.touchPanRate;
        this.keyboardRotationRate = cfg.keyboardRotationRate;
        this.dragRotationRate = cfg.dragRotationRate;
        this.touchDollyRate = cfg.touchDollyRate;
        this.dollyInertia = cfg.dollyInertia;
        this.dollyProximityThreshold = cfg.dollyProximityThreshold;
        this.dollyMinSpeed = cfg.dollyMinSpeed;
        this.panInertia = cfg.panInertia;
        this.pointerEnabled = true;
        this.keyboardDollyRate = cfg.keyboardDollyRate;
        this.mouseWheelDollyRate = cfg.mouseWheelDollyRate;
    }

    /**
     * Sets custom mappings of keys to ````CameraControl```` actions.
     *
     * See class docs for usage.
     *
     * @param {{Number:Number}|String} value Either a set of new key mappings, or a string to select a keyboard layout,
     * which causes ````CameraControl```` to use the default key mappings for that layout.
     */
    set keyMap(value: string) {
        value = value || "qwerty";
        if (isString(value)) {
            const keyMap = {};

            switch (value) {

                default:
                    this.error("Unsupported value for 'keyMap': " + value + " defaulting to 'qwerty'");
                // Intentional fall-through to "qwerty"
                case "qwerty":
                    keyMap[CameraControl.PAN_LEFT] = [KEY_A];
                    keyMap[CameraControl.PAN_RIGHT] = [KEY_D];
                    keyMap[CameraControl.PAN_UP] = [KEY_Z];
                    keyMap[CameraControl.PAN_DOWN] = [KEY_X];
                    keyMap[CameraControl.PAN_BACKWARDS] = [];
                    keyMap[CameraControl.PAN_FORWARDS] = [];
                    keyMap[CameraControl.DOLLY_FORWARDS] = [KEY_W, KEY_ADD];
                    keyMap[CameraControl.DOLLY_BACKWARDS] = [KEY_S, KEY_SUBTRACT];
                    keyMap[CameraControl.ROTATE_X_POS] = [KEY_DOWN_ARROW];
                    keyMap[CameraControl.ROTATE_X_NEG] = [KEY_UP_ARROW];
                    keyMap[CameraControl.ROTATE_Y_POS] = [KEY_Q, KEY_LEFT_ARROW];
                    keyMap[CameraControl.ROTATE_Y_NEG] = [KEY_E, KEY_RIGHT_ARROW];
                    keyMap[CameraControl.AXIS_VIEW_RIGHT] = [KEY_NUM_1];
                    keyMap[CameraControl.AXIS_VIEW_BACK] = [KEY_NUM_2];
                    keyMap[CameraControl.AXIS_VIEW_LEFT] = [KEY_NUM_3];
                    keyMap[CameraControl.AXIS_VIEW_FRONT] = [KEY_NUM_4];
                    keyMap[CameraControl.AXIS_VIEW_TOP] = [KEY_NUM_5];
                    keyMap[CameraControl.AXIS_VIEW_BOTTOM] = [KEY_NUM_6];
                    break;

                case "azerty":
                    keyMap[CameraControl.PAN_LEFT] = [KEY_Q];
                    keyMap[CameraControl.PAN_RIGHT] = [KEY_D];
                    keyMap[CameraControl.PAN_UP] = [KEY_W];
                    keyMap[CameraControl.PAN_DOWN] = [KEY_X];
                    keyMap[CameraControl.PAN_BACKWARDS] = [];
                    keyMap[CameraControl.PAN_FORWARDS] = [];
                    keyMap[CameraControl.DOLLY_FORWARDS] = [KEY_Z, KEY_ADD];
                    keyMap[CameraControl.DOLLY_BACKWARDS] = [KEY_S, KEY_SUBTRACT];
                    keyMap[CameraControl.ROTATE_X_POS] = [KEY_DOWN_ARROW];
                    keyMap[CameraControl.ROTATE_X_NEG] = [KEY_UP_ARROW];
                    keyMap[CameraControl.ROTATE_Y_POS] = [KEY_A, KEY_LEFT_ARROW];
                    keyMap[CameraControl.ROTATE_Y_NEG] = [KEY_E, KEY_RIGHT_ARROW];
                    keyMap[CameraControl.AXIS_VIEW_RIGHT] = [KEY_NUM_1];
                    keyMap[CameraControl.AXIS_VIEW_BACK] = [KEY_NUM_2];
                    keyMap[CameraControl.AXIS_VIEW_LEFT] = [KEY_NUM_3];
                    keyMap[CameraControl.AXIS_VIEW_FRONT] = [KEY_NUM_4];
                    keyMap[CameraControl.AXIS_VIEW_TOP] = [KEY_NUM_5];
                    keyMap[CameraControl.AXIS_VIEW_BOTTOM] = [KEY_NUM_6];
                    break;
            }

            this.#keyMap  = keyMap;
        } else {
            const keyMap = value;
            this.#keyMap  = keyMap;
        }
    }

    /**
     * Gets custom mappings of keys to {@link CameraControl} actions.
     *
     * @returns {{Number:Number}} Current key mappings.
     */
    get keyMap() {
        return this.#keyMap ;
    }

    /**
     * Returns true if any keys configured for the given action are down.
     * @param action
     * @param keyDownMap
     * @private
     */
    _isKeyDownForAction(action: number, keyDownMap: any) {
        // const keys = this.#keyMap [action];
        // if (!keys) {
        //     return false;
        // }
        // if (!keyDownMap) {
        //     keyDownMap = this.view.KEYDown;
        // }
        // for (let i = 0, len = keys.length; i < len; i++) {
        //     const key = keys[i];
        //     if (keyDownMap[key]) {
        //         return true;
        //     }
        // }
        return false;
    }

    /**
     * Sets the HTMl element to represent the pivot point when {@link CameraControl#followPointer} is true.
     *
     * See class comments for an example.
     *
     * @param {HTMLElement} element HTML element representing the pivot point.
     */
    set pivotElement(element: HTMLElement) {
        this.#controllers.pivotController.setPivotElement(element);
    }

    /**
     *  Sets if this ````CameraControl```` is active or not.
     *
     * When inactive, the ````CameraControl```` will not react to input.
     *
     * Default is ````true````.
     *
     * @param {Boolean} value Set ````true```` to activate this ````CameraControl````.
     */
    set active(value: boolean) {
        value = value !== false;
        this.#configs.active = value;
        this.#handlers[1]._active = value;
        this.#handlers[5]._active = value;
    }

    /**
     * Gets if this ````CameraControl```` is active or not.
     *
     * When inactive, the ````CameraControl```` will not react to input.
     *
     * Default is ````true````.
     *
     * @returns {Boolean} Returns ````true```` if this ````CameraControl```` is active.
     */
    get active() : boolean{
        return this.#configs.active;
    }

    /**
     * Sets whether the pointer snap to vertex.
     *
     * @param {boolean} snapToVertex
     */
    set snapToVertex(snapToVertex: boolean) {
        this.#configs.snapToVertex = !!snapToVertex;
    }

    /**
     * Gets whether the pointer snap to vertex.
     *
     * @returns {boolean}
     */
    get snapToVertex() : boolean{
        return this.#configs.snapToVertex;
    }

    /**
     * Sets whether the pointer snap to edge.
     *
     * @param {boolean} snapToEdge
     */
    set snapToEdge(snapToEdge: boolean) {
        this.#configs.snapToEdge = !!snapToEdge;
    }

    /**
     * Gets whether the pointer snap to edge.
     *
     * @returns {boolean}
     */
    get snapToEdge(): boolean {
        return this.#configs.snapToEdge;
    }

    /**
     * Sets the current snap radius for "hoverSnapOrSurface" events, to specify whether the radius
     * within which the pointer snaps to the nearest vertex or the nearest edge.
     *
     * Default value is 30 pixels.
     *
     * @param {Number} snapRadius The snap radius.
     */
    set snapRadius(snapRadius: number) {
        snapRadius = snapRadius || DEFAULT_SNAP_PICK_RADIUS;
        this.#configs.snapRadius = snapRadius;
    }

    /**
     * Gets the current snap radius.
     *
     * @returns {Number} The snap radius.
     */
    get snapRadius() : number{
        return this.#configs.snapRadius;
    }

    /**
     * If `true`, the keyboard shortcuts are enabled ONLY if the mouse is over the canvas.
     *
     * @param {boolean} value
     */
    set keyboardEnabledOnlyIfMouseover(value: boolean) {
        this.#configs.keyboardEnabledOnlyIfMouseover = !!value;
    }

    /**
     * Gets whether the keyboard shortcuts are enabled ONLY if the mouse is over the canvas or ALWAYS.
     *
     * @returns {boolean}
     */
    get keyboardEnabledOnlyIfMouseover() : boolean{
        return this.#configs.keyboardEnabledOnlyIfMouseover;
    }

    /**
     * Gets the current navigation mode.
     *
     * Returned values are:
     *
     * * {@link @xeokit/constants!OrbitNavigationMode} - rotation orbits about the current target or pivot point,
     * * {@link @xeokit/constants!FirstPersonNavigationMode} - rotation is about the current eye position,
     * * {@link @xeokit/constants!PlanViewNavigationMode} - rotation is disabled.
     *
     * @returns {number} The navigation mode: OrbitNavigationMode, FirstPersonNavigationMode or PlanViewNavigationMode.
     */
    get navMode(): number {
        return this.#configs.navMode;
    }

    /**
     * Sets the current navigation mode.
     *
     * Accepted values are:
     *
     * * {@link @xeokit/constants!OrbitNavigationMode} - rotation orbits about the current target or pivot point,
     * * {@link @xeokit/constants!FirstPersonNavigationMode} - rotation is about the current eye position,
     * * {@link @xeokit/constants!PlanViewNavigationMode} - rotation is disabled.
     *
     * See class comments for more info.
     *
     * @param navMode The navigation mode: OrbitNavigationMode, FirstPersonNavigationMode or PlanViewNavigationMode.
     */
    set navMode(navMode: number | undefined) {
        navMode = navMode || OrbitNavigationMode;
        if (navMode !== FirstPersonNavigationMode && navMode !== OrbitNavigationMode && navMode !== PlanViewNavigationMode) {
            this.error("Unsupported value for navMode: " + navMode + " - supported values are 'orbit', 'firstPerson' and 'planView' - defaulting to 'orbit'");
            navMode = OrbitNavigationMode;
        }
        this.#configs.firstPerson = (navMode === FirstPersonNavigationMode);
        this.#configs.planView = (navMode === PlanViewNavigationMode);
        if (this.#configs.firstPerson || this.#configs.planView) {
            this.#controllers.pivotController.hidePivot();
            this.#controllers.pivotController.endPivot();
        }
        this.#configs.navMode = navMode;
    }

    /**
     * Sets whether mouse and touch input is enabled.
     *
     * Default is ````true````.
     *
     * Disabling mouse and touch input on ````CameraControl```` is useful when we want to temporarily use mouse or
     * touch input to interact with some other 3D control, without disturbing the {@link Camera}.
     *
     * @param {Boolean} value Set ````true```` to enable mouse and touch input.
     */
    set pointerEnabled(value) {
        this._reset();
        this.#configs.pointerEnabled = !!value;
    }

    _reset() {
        for (let i = 0, len = this.#handlers.length; i < len; i++) {
            const handler = this.#handlers[i];
            if (handler.reset) {
                handler.reset();
            }
        }

        this.#updates.panDeltaX = 0;
        this.#updates.panDeltaY = 0;
        this.#updates.rotateDeltaX = 0;
        this.#updates.rotateDeltaY = 0;
        this.#updates.dollyDelta = 0;
    }

    /**
     * Gets whether mouse and touch input is enabled.
     *
     * Default is ````true````.
     *
     * Disabling mouse and touch input on ````CameraControl```` is desirable when we want to temporarily use mouse or
     * touch input to interact with some other 3D control, without interfering with the {@link Camera}.
     *
     * @returns {Boolean} Returns ````true```` if mouse and touch input is enabled.
     */
    get pointerEnabled() {
        return this.#configs.pointerEnabled;
    }

    /**
     * Sets whether the {@link Camera} follows the mouse/touch pointer.
     *
     * In orbiting mode, the Camera will orbit about the pointer, and will dolly to and from the pointer.
     *
     * In fly-to mode, the Camera will dolly to and from the pointer, however the World will always rotate about the Camera position.
     *
     * In plan-view mode, the Camera will dolly to and from the pointer, however the Camera will not rotate.
     *
     * Default is ````true````.
     *
     * See class comments for more info.
     *
     * @param {Boolean} value Set ````true```` to enable the Camera to follow the pointer.
     */
    set followPointer(value) {
        this.#configs.followPointer = (value !== false);
    }

    /**
     * Sets whether the {@link Camera} follows the mouse/touch pointer.
     *
     * In orbiting mode, the Camera will orbit about the pointer, and will dolly to and from the pointer.
     *
     * In fly-to mode, the Camera will dolly to and from the pointer, however the World will always rotate about the Camera position.
     *
     * In plan-view mode, the Camera will dolly to and from the pointer, however the Camera will not rotate.
     *
     * Default is ````true````.
     *
     * See class comments for more info.
     *
     * @returns {Boolean} Returns ````true```` if the Camera follows the pointer.
     */
    get followPointer() {
        return this.#configs.followPointer;
    }

    /**
     * Sets the current World-space 3D target position.
     *
     * Only applies when {@link CameraControl#followPointer} is ````true````.
     *
     * @param {Number[]} worldPos The new World-space 3D target position.
     */
    set pivotPos(worldPos) {
        this.#controllers.pivotController.setPivotPos(worldPos);
    }

    /**
     * Gets the current World-space 3D pivot position.
     *
     * Only applies when {@link CameraControl#followPointer} is ````true````.
     *
     * @return {Number[]} worldPos The current World-space 3D pivot position.
     */
    get pivotPos() {
        return this.#controllers.pivotController.getPivotPos();
    }

    /**
     * @deprecated
     * @param {Boolean} value Set ````true```` to enable dolly-to-pointer behaviour.
     */
    set dollyToPointer(value) {
        this.warn("dollyToPointer property is deprecated - replaced with followPointer");
        this.followPointer = value;
    }

    /**
     * @deprecated
     * @returns {Boolean} Returns ````true```` if dolly-to-pointer behaviour is enabled.
     */
    get dollyToPointer() {
        this.warn("dollyToPointer property is deprecated - replaced with followPointer");
        return this.followPointer;
    }

    /**
     * @deprecated
     * @param {Boolean} value Set ````true```` to enable dolly-to-pointer behaviour.
     */
    set panToPointer(value) {
        this.warn("panToPointer property is deprecated - replaced with followPointer");
    }

    /**
     * @deprecated
     * @returns {Boolean} Returns ````true```` if dolly-to-pointer behaviour is enabled.
     */
    get panToPointer() {
        this.warn("panToPointer property is deprecated - replaced with followPointer");
        return false;
    }

    /**
     * Sets whether this ````CameraControl```` is in plan-view mode.
     *
     * When in plan-view mode, rotation is disabled.
     *
     * Default is ````false````.
     *
     * Deprecated - use {@link CameraControl#navMode} instead.
     *
     * @param {Boolean} value Set ````true```` to enable plan-view mode.
     * @deprecated
     */
    set planView(value) {
        this.#configs.planView = !!value;
        this.#configs.firstPerson = false;
        if (this.#configs.planView) {
            this.#controllers.pivotController.hidePivot();
            this.#controllers.pivotController.endPivot();
        }
        this.warn("planView property is deprecated - replaced with navMode");
    }

    /**
     * Gets whether this ````CameraControl```` is in plan-view mode.
     *
     * When in plan-view mode, rotation is disabled.
     *
     * Default is ````false````.
     *
     * Deprecated - use {@link CameraControl#navMode} instead.
     *
     * @returns {Boolean} Returns ````true```` if plan-view mode is enabled.
     * @deprecated
     */
    get planView() {
        this.warn("planView property is deprecated - replaced with navMode");
        return this.#configs.planView;
    }

    /**
     * Sets whether this ````CameraControl```` is in first-person mode.
     *
     * In "first person" mode (disabled by default) the look position rotates about the eye position. Otherwise,  {@link Camera#eye} rotates about {@link Camera#look}.
     *
     * Default is ````false````.
     *
     * Deprecated - use {@link CameraControl#navMode} instead.
     *
     * @param {Boolean} value Set ````true```` to enable first-person mode.
     * @deprecated
     */
    set firstPerson(value) {
        this.warn("firstPerson property is deprecated - replaced with navMode");
        this.#configs.firstPerson = !!value;
        this.#configs.planView = false;
        if (this.#configs.firstPerson) {
            this.#controllers.pivotController.hidePivot();
            this.#controllers.pivotController.endPivot();
        }
    }

    /**
     * Gets whether this ````CameraControl```` is in first-person mode.
     *
     * In "first person" mode (disabled by default) the look position rotates about the eye position. Otherwise,  {@link Camera#eye} rotates about {@link Camera#look}.
     *
     * Default is ````false````.
     *
     * Deprecated - use {@link CameraControl#navMode} instead.
     *
     * @returns {Boolean} Returns ````true```` if first-person mode is enabled.
     * @deprecated
     */
    get firstPerson() {
        this.warn("firstPerson property is deprecated - replaced with navMode");
        return this.#configs.firstPerson;
    }

    /**
     * Sets whether to vertically constrain the {@link Camera} position for first-person navigation.
     *
     * When set ````true````, this constrains {@link Camera#eye} to its current vertical position.
     *
     * Only applies when {@link CameraControl#navMode} is ````"firstPerson"````.
     *
     * Default is ````false````.
     *
     * @param {Boolean} value Set ````true```` to vertically constrain the Camera.
     */
    set constrainVertical(value) {
        this.#configs.constrainVertical = !!value;
    }

    /**
     * Gets whether to vertically constrain the {@link Camera} position for first-person navigation.
     *
     * When set ````true````, this constrains {@link Camera#eye} to its current vertical position.
     *
     * Only applies when {@link CameraControl#navMode} is ````"firstPerson"````.
     *
     * Default is ````false````.
     *
     * @returns {Boolean} ````true```` when Camera is vertically constrained.
     */
    get constrainVertical() {
        return this.#configs.constrainVertical;
    }

    /**
     * Sets whether double-picking an {@link Entity} causes the {@link Camera} to fly to its boundary.
     *
     * Default is ````false````.
     *
     * @param {Boolean} value Set ````true```` to enable double-pick-fly-to mode.
     */
    set doublePickFlyTo(value) {
        this.#configs.doublePickFlyTo = value !== false;
    }

    /**
     * Gets whether double-picking an {@link Entity} causes the {@link Camera} to fly to its boundary.
     *
     * Default is ````false````.
     *
     * @returns {Boolean} Returns ````true```` when double-pick-fly-to mode is enabled.
     */
    get doublePickFlyTo() {
        return this.#configs.doublePickFlyTo;
    }

    /**
     * Sets whether either right-clicking (true) or middle-clicking (false) pans the {@link Camera}.
     *
     * Default is ````true````.
     *
     * @param {Boolean} value Set ````false```` to disable pan on right-click.
     */
    set panRightClick(value) {
        this.#configs.panRightClick = value !== false;
    }

    /**
     * Gets whether right-clicking pans the {@link Camera}.
     *
     * Default is ````true````.
     *
     * @returns {Boolean} Returns ````false```` when pan on right-click is disabled.
     */
    get panRightClick() {
        return this.#configs.panRightClick;
    }

    /**
     * Sets a factor in range ````[0..1]```` indicating how much the {@link Camera} keeps moving after you finish rotating it.
     *
     * A value of ````0.0```` causes it to immediately stop, ````0.5```` causes its movement to decay 50% on each tick,
     * while ````1.0```` causes no decay, allowing it continue moving, by the current rate of rotation.
     *
     * You may choose an inertia of zero when you want be able to precisely rotate the Camera,
     * without interference from inertia. Zero inertia can also mean that less frames are rendered while
     * you are rotating the Camera.
     *
     * Default is ````0.0````.
     *
     * Does not apply when {@link CameraControl#navMode} is ````"planView"````, which disallows rotation.
     *
     * @param {Number} rotationInertia New inertial factor.
     */
    set rotationInertia(rotationInertia) {
        this.#configs.rotationInertia = (rotationInertia !== undefined && rotationInertia !== null) ? rotationInertia : 0.0;
    }

    /**
     * Gets the rotation inertia factor.
     *
     * Default is ````0.0````.
     *
     * Does not apply when {@link CameraControl#navMode} is ````"planView"````, which disallows rotation.
     *
     * @returns {Number} The inertia factor.
     */
    get rotationInertia() {
        return this.#configs.rotationInertia;
    }

    /**
     * Sets how much the {@link Camera} pans each second with keyboard input.
     *
     * Default is ````5.0````, to pan the Camera ````5.0```` World-space units every second that
     * a panning key is depressed. See the ````CameraControl```` class documentation for which keys control
     * panning.
     *
     * Panning direction is aligned to our Camera's orientation. When we pan horizontally, we pan
     * to our left and right, when we pan vertically, we pan upwards and downwards, and when we pan forwards
     * and backwards, we pan along the direction the Camera is pointing.
     *
     * Unlike dollying when {@link followPointer} is ````true````, panning does not follow the pointer.
     *
     * @param {Number} keyboardPanRate The new keyboard pan rate.
     */
    set keyboardPanRate(keyboardPanRate) {
        this.#configs.keyboardPanRate = (keyboardPanRate !== null && keyboardPanRate !== undefined) ? keyboardPanRate : 5.0;
    }


    /**
     * Sets how fast the camera pans on touch panning
     *
     * @param {Number} touchPanRate The new touch pan rate.
     */
    set touchPanRate(touchPanRate) {
        this.#configs.touchPanRate = (touchPanRate !== null && touchPanRate !== undefined) ? touchPanRate : 1.0;
    }

    /**
     * Gets how fast the {@link Camera} pans on touch panning
     *
     * Default is ````1.0````.
     *
     * @returns {Number} The current touch pan rate.
     */
    get touchPanRate() {
        return this.#configs.touchPanRate;
    }

    /**
     * Gets how much the {@link Camera} pans each second with keyboard input.
     *
     * Default is ````5.0````.
     *
     * @returns {Number} The current keyboard pan rate.
     */
    get keyboardPanRate() {
        return this.#configs.keyboardPanRate;
    }

    /**
     * Sets how many degrees per second the {@link Camera} rotates/orbits with keyboard input.
     *
     * Default is ````90.0````, to rotate/orbit the Camera ````90.0```` degrees every second that
     * a rotation key is depressed. See the ````CameraControl```` class documentation for which keys control
     * rotation/orbit.
     *
     * @param {Number} keyboardRotationRate The new keyboard rotation rate.
     */
    set keyboardRotationRate(keyboardRotationRate) {
        this.#configs.keyboardRotationRate = (keyboardRotationRate !== null && keyboardRotationRate !== undefined) ? keyboardRotationRate : 90.0;
    }

    /**
     * Sets how many degrees per second the {@link Camera} rotates/orbits with keyboard input.
     *
     * Default is ````90.0````.
     *
     * @returns {Number} The current keyboard rotation rate.
     */
    get keyboardRotationRate() {
        return this.#configs.keyboardRotationRate;
    }

    /**
     * Sets the current drag rotation rate.
     *
     * This configures how many degrees the {@link Camera} rotates/orbits for a full sweep of the canvas by mouse or touch dragging.
     *
     * For example, a value of ````360.0```` indicates that the ````Camera```` rotates/orbits ````360.0```` degrees horizontally
     * when we sweep the entire width of the canvas.
     *
     * ````CameraControl```` makes vertical rotation half as sensitive as horizontal rotation, so that we don't tend to
     * flip upside-down. Therefore, a value of ````360.0```` rotates/orbits the ````Camera```` through ````180.0```` degrees
     * vertically when we sweep the entire height of the canvas.
     *
     * Default is ````360.0````.
     *
     * @param {Number} dragRotationRate The new drag rotation rate.
     */
    set dragRotationRate(dragRotationRate) {
        this.#configs.dragRotationRate = (dragRotationRate !== null && dragRotationRate !== undefined) ? dragRotationRate : 360.0;
    }

    /**
     * Gets the current drag rotation rate.
     *
     * Default is ````360.0````.
     *
     * @returns {Number} The current drag rotation rate.
     */
    get dragRotationRate() {
        return this.#configs.dragRotationRate;
    }

    /**
     * Sets how much the {@link Camera} dollys each second with keyboard input.
     *
     * Default is ````15.0````, to dolly the {@link Camera} ````15.0```` World-space units per second while we hold down
     * the ````+```` and ````-```` keys.
     *
     * @param {Number} keyboardDollyRate The new keyboard dolly rate.
     */
    set keyboardDollyRate(keyboardDollyRate) {
        this.#configs.keyboardDollyRate = (keyboardDollyRate !== null && keyboardDollyRate !== undefined) ? keyboardDollyRate : 15.0;
    }

    /**
     * Gets how much the {@link Camera} dollys each second with keyboard input.
     *
     * Default is ````15.0````.
     *
     * @returns {Number} The current keyboard dolly rate.
     */
    get keyboardDollyRate() {
        return this.#configs.keyboardDollyRate;
    }

    /**
     * Sets how much the {@link Camera} dollys with touch input.
     *
     * Default is ````0.2````
     *
     * @param {Number} touchDollyRate The new touch dolly rate.
     */
    set touchDollyRate(touchDollyRate) {
        this.#configs.touchDollyRate = (touchDollyRate !== null && touchDollyRate !== undefined) ? touchDollyRate : 0.2;
    }

    /**
     * Gets how much the {@link Camera} dollys each second with touch input.
     *
     * Default is ````0.2````.
     *
     * @returns {Number} The current touch dolly rate.
     */
    get touchDollyRate() {
        return this.#configs.touchDollyRate;
    }

    /**
     * Sets how much the {@link Camera} dollys each second while the mouse wheel is spinning.
     *
     * Default is ````100.0````, to dolly the {@link Camera} ````10.0```` World-space units per second as we spin
     * the mouse wheel.
     *
     * @param {Number} mouseWheelDollyRate The new mouse wheel dolly rate.
     */
    set mouseWheelDollyRate(mouseWheelDollyRate) {
        this.#configs.mouseWheelDollyRate = (mouseWheelDollyRate !== null && mouseWheelDollyRate !== undefined) ? mouseWheelDollyRate : 100.0;
    }

    /**
     * Gets how much the {@link Camera} dollys each second while the mouse wheel is spinning.
     *
     * Default is ````100.0````.
     *
     * @returns {Number} The current mouseWheel dolly rate.
     */
    get mouseWheelDollyRate() {
        return this.#configs.mouseWheelDollyRate;
    }

    /**
     * Sets the dolly inertia factor.
     *
     * This factor configures how much the {@link Camera} keeps moving after you finish dollying it.
     *
     * This factor is a value in range ````[0..1]````. A value of ````0.0```` causes dollying to immediately stop,
     * ````0.5```` causes dollying to decay 50% on each animation frame, while ````1.0```` causes no decay, which allows dollying
     * to continue until further input stops it.
     *
     * You might set ````dollyInertia```` to zero when you want be able to precisely position or rotate the Camera,
     * without interference from inertia. This also means that xeokit renders less frames while dollying the Camera,
     * which can improve rendering performance.
     *
     * Default is ````0````.
     *
     * @param {Number} dollyInertia New dolly inertia factor.
     */
    set dollyInertia(dollyInertia) {
        this.#configs.dollyInertia = (dollyInertia !== undefined && dollyInertia !== null) ? dollyInertia : 0;
    }

    /**
     * Gets the dolly inertia factor.
     *
     * Default is ````0````.
     *
     * @returns {Number} The current dolly inertia factor.
     */
    get dollyInertia() {
        return this.#configs.dollyInertia;
    }

    /**
     * Sets the proximity to the closest object below which dolly speed decreases, and above which dolly speed increases.
     *
     * Default is ````35.0````.
     *
     * @param {Number} dollyProximityThreshold New dolly proximity threshold.
     */
    set dollyProximityThreshold(dollyProximityThreshold) {
        this.#configs.dollyProximityThreshold = (dollyProximityThreshold !== undefined && dollyProximityThreshold !== null) ? dollyProximityThreshold : 35.0;
    }

    /**
     * Gets the proximity to the closest object below which dolly speed decreases, and above which dolly speed increases.
     *
     * Default is ````35.0````.
     *
     * @returns {Number} The current dolly proximity threshold.
     */
    get dollyProximityThreshold() {
        return this.#configs.dollyProximityThreshold;
    }

    /**
     * Sets the minimum dolly speed.
     *
     * Default is ````0.04````.
     *
     * @param {Number} dollyMinSpeed New dolly minimum speed.
     */
    set dollyMinSpeed(dollyMinSpeed) {
        this.#configs.dollyMinSpeed = (dollyMinSpeed !== undefined && dollyMinSpeed !== null) ? dollyMinSpeed : 0.04;
    }

    /**
     * Gets the minimum dolly speed.
     *
     * Default is ````0.04````.
     *
     * @returns {Number} The current minimum dolly speed.
     */
    get dollyMinSpeed() {
        return this.#configs.dollyMinSpeed;
    }

    /**
     * Sets the pan inertia factor.
     *
     * This factor configures how much the {@link Camera} keeps moving after you finish panning it.
     *
     * This factor is a value in range ````[0..1]````. A value of ````0.0```` causes panning to immediately stop,
     * ````0.5```` causes panning to decay 50% on each animation frame, while ````1.0```` causes no decay, which allows panning
     * to continue until further input stops it.
     *
     * You might set ````panInertia```` to zero when you want be able to precisely position or rotate the Camera,
     * without interference from inertia. This also means that xeokit renders less frames while panning the Camera,
     * wich can improve rendering performance.
     *
     * Default is ````0.5````.
     *
     * @param {Number} panInertia New pan inertia factor.
     */
    set panInertia(panInertia) {
        this.#configs.panInertia = (panInertia !== undefined && panInertia !== null) ? panInertia : 0.5;
    }

    /**
     * Gets the pan inertia factor.
     *
     * Default is ````0.5````.
     *
     * @returns {Number} The current pan inertia factor.
     */
    get panInertia() {
        return this.#configs.panInertia;
    }

    /**
     * Sets the keyboard layout.
     *
     * Supported layouts are:
     *
     * * ````"qwerty"```` (default)
     * * ````"azerty"````
     *
     * @deprecated
     * @param {String} value Selects the keyboard layout.
     */
    set keyboardLayout(value) {
        // this.warn("keyboardLayout property is deprecated - use keyMap property instead");
        value = value || "qwerty";
        if (value !== "qwerty" && value !== "azerty") {
            this.error("Unsupported value for keyboardLayout - defaulting to 'qwerty'");
            value = "qwerty";
        }
        this.#configs.keyboardLayout = value;
        this.keyMap = this.#configs.keyboardLayout;
    }

    /**
     * Gets the keyboard layout.
     *
     * Supported layouts are:
     *
     * * ````"qwerty"```` (default)
     * * ````"azerty"````
     *
     * @deprecated
     * @returns {String} The current keyboard layout.
     */
    get keyboardLayout() {
        return this.#configs.keyboardLayout;
    }

    /**
     * Sets a sphere as the representation of the pivot position.
     *
     * @param {Object} [cfg] Sphere configuration.
     * @param {String} [cfg.size=1] Optional size factor of the sphere. Defaults to 1.
     * @param {String} [cfg.material=PhongMaterial] Optional size factor of the sphere. Defaults to a red opaque material.
     */
    enablePivotSphere(cfg = {}) {
        this.#controllers.pivotController.enablePivotSphere(cfg);
    }

    /**
     * Remove the sphere as the representation of the pivot position.
     *
     */
    disablePivotSphere() {
        this.#controllers.pivotController.disablePivotSphere();
    }

    /**
     * Sets whether smart default pivoting is enabled.
     *
     * When ````true````, we'll pivot by default about the 3D position of the mouse/touch pointer on an
     * imaginary sphere that's centered at {@link Camera#eye} and sized to the {@link Scene} boundary.
     *
     * When ````false````, we'll pivot by default about {@link Camera#look}.
     *
     * Default is ````false````.
     *
     * @param {Boolean} enabled Set ````true```` to pivot by default about the selected point on the virtual sphere, or ````false```` to pivot by default about {@link Camera#look}.
     */
    set smartPivot(enabled) {
        this.#configs.smartPivot = (enabled !== false);
    }

    /**
     * Gets whether smart default pivoting is enabled.
     *
     * When ````true````, we'll pivot by default about the 3D position of the mouse/touch pointer on an
     * imaginary sphere that's centered at {@link Camera#eye} and sized to the {@link Scene} boundary.
     *
     * When ````false````, we'll pivot by default about {@link Camera#look}.
     *
     * Default is ````false````.
     *
     * @returns {Boolean} Returns ````true```` when pivoting by default about the selected point on the virtual sphere, or ````false```` when pivoting by default about {@link Camera#look}.
     */
    get smartPivot() {
        return this.#configs.smartPivot;
    }

    /**
     * Sets the double click time frame length in milliseconds.
     *
     * If two mouse click events occur within this time frame, it is considered a double click.
     *
     * Default is ````250````
     *
     * @param {Number} value New double click time frame.
     */
    set doubleClickTimeFrame(value) {
        this.#configs.doubleClickTimeFrame = (value !== undefined && value !== null) ? value : 250;
    }

    /**
     * Gets the double click time frame length in milliseconds.
     *
     * Default is ````250````
     *
     * @param {Number} value Current double click time frame.
     */
    get doubleClickTimeFrame() {
        return this.#configs.doubleClickTimeFrame;
    }

    /**
     * Destroys this ````CameraControl````.
     * @private
     */
    destroy() {
        this._destroyHandlers();
        this._destroyControllers();
        this.#cameraUpdater.destroy();
        super.destroy();
    }

    _destroyHandlers() {
        for (let i = 0, len = this.#handlers.length; i < len; i++) {
            const handler = this.#handlers[i];
            if (handler.destroy) {
                handler.destroy();
            }
        }
    }

    _destroyControllers() {
        for (let key in this.#controllers) {
            const controller = this.#controllers[key];
            if (controller.destroy) {
                controller.destroy();
            }
        }
    }
}

