import { EventEmitter} from "../core";
import {FirstPersonNavigationMode, OrbitNavigationMode, PlanViewNavigationMode, QWERTYLayout} from "../constants";
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
import type {PickResult, View} from "../viewer";
import type {CameraControlParams} from "./CameraControlParams";
import {CameraFlightAnimation} from "../cameraflight";
import {CameraUpdater} from "./CameraUpdater";
import {createVec2Float64, type Vec3} from "../math/vector";
import {EventDispatcher} from "strongly-typed-events";
import {isString} from "../utils";
import {KeyboardAxisViewHandler} from "./KeyboardAxisViewHandler";
import {KeyboardPanRotateDollyHandler} from "./KeyboardPanRotateDollyHandler";
import {MouseMiscHandler} from "./MouseMiscHandler";
import {MousePanRotateDollyHandler} from "./MousePanRotateDollyHandler";
import {MousePickHandler} from "./MousePickHandler";
import {PanController} from "./PanController";
import {PickController} from "./PickController";
import {PivotController} from "./PivotController";
import {TouchPanRotateAndDollyHandler} from "./TouchPanRotateAndDollyHandler";
import {TouchPickHandler} from "./TouchPickHandler";


const DEFAULT_SNAP_PICK_RADIUS = 30;
const DEFAULT_SNAP_VERTEX = true;
const DEFAULT_SNAP_EDGE = true;

/**
 *
 */
export class HoverEvent {
}

/**
 * Mouse and touch controller for a {@link viewer!Viewer | Viewer's} {@link viewer!Camera | Camera}.
 *
 * See {@link cameracontrol | @xeokit/sdk/cameracontrol} for usage.
 */
export class CameraControl {

  /**
   * Represents a leftward panning action.
   */
  static PAN_LEFT = 0;

  /**
   * Represents a rightward panning action.
   */
  static PAN_RIGHT = 1;

  /**
   * Represents an upward panning action.
   */
  static PAN_UP = 2;

  /**
   * Represents a downward panning action.
   */
  static PAN_DOWN = 3;

  /**
   * Represents a forward panning action.
   */
  static PAN_FORWARDS = 4;

  /**
   * Represents a backward panning action.
   */
  static PAN_BACKWARDS = 5;

  /**
   * Rotates the view clockwise around the X-axis.
   */
  static ROTATE_X_POS = 6;

  /**
   * Rotates the view counterclockwise around the X-axis.
   */
  static ROTATE_X_NEG = 7;

  /**
   * Rotates the view clockwise around the Y-axis.
   */
  static ROTATE_Y_POS = 8;

  /**
   * Rotates the view counterclockwise around the Y-axis.
   */
  static ROTATE_Y_NEG = 9;

  /**
   * Moves the camera forward (dolly in).
   */
  static DOLLY_FORWARDS = 10;

  /**
   * Moves the camera backward (dolly out).
   */
  static DOLLY_BACKWARDS = 11;

  /**
   * Positions the {@link viewer!Camera | Camera} to view the right side
   * of the entire extents of the {@link viewer!View | View}.
   */
  static AXIS_VIEW_RIGHT = 12;

  /**
   * Positions the {@link viewer!Camera | Camera} to view the back side
   * of the entire extents of the {@link viewer!View | View}.
   */
  static AXIS_VIEW_BACK = 13;

  /**
   * Positions the {@link viewer!Camera | Camera} to view the left side
   * of the entire extents of the {@link viewer!View | View}.
   */
  static AXIS_VIEW_LEFT = 14;

  /**
   * Positions the {@link viewer!Camera | Camera} to view the front side
   * of the entire extents of the {@link viewer!View | View}.
   */
  static AXIS_VIEW_FRONT = 15;

  /**
   * Positions the {@link viewer!Camera | Camera} to look downward
   * at the entire extents of the {@link viewer!View | View}.
   */
  static AXIS_VIEW_TOP = 16;

  /**
   * Positions the {@link viewer!Camera | Camera} to look upward from below
   * at the entire extents of the {@link viewer!View | View}.
   */
  static AXIS_VIEW_BOTTOM = 17;

  /**
   * The {@link viewer!View | View} to which this CameraControl belongs.
   */
  view: View;

  /**
   * Event fired when we right-click.
   */
  readonly onRightClick: EventEmitter<CameraControl, any>;

  /**
   * Event fired when the pointer moves while over a {@link viewer!ViewObject | ViewObject}.
   */
  readonly onHover: EventEmitter<CameraControl, HoverEvent>;

  /**
   * Event fired when the pointer moves while over a {@link viewer!ViewObject | ViewObject}.
   */
  readonly onHoverSurface: EventEmitter<CameraControl, HoverEvent>;

  /**
   * Event fired when the pointer moves while over empty space.
   */
  readonly onHoverOff: EventEmitter<CameraControl, HoverEvent>;

  /**
   * Event fired when the pointer moves onto a {@link viewer!ViewObject | ViewObject}.
   */
  readonly onHoverEnter: EventEmitter<CameraControl, HoverEvent>;

  /**
   * Event fired when the pointer moves off a {@link viewer!ViewObject | ViewObject}.
   */
  readonly onHoverOut: EventEmitter<CameraControl, HoverEvent>;

  /**
   * Event fired when a {@link viewer!ViewObject | ViewObject} is picked.
   */
  readonly onPicked: EventEmitter<CameraControl, PickResult>;

  /**
   * Event fired when empty space is picked.
   */
  readonly onPickedSurface: EventEmitter<CameraControl, PickResult>;

  /**
   * Event fired when empty space is picked.
   */
  readonly onPickedNothing: EventEmitter<CameraControl, null>;

  /**
   * Event fired when a ViewObject is double-picked.
   */
  readonly onDoublePicked: EventEmitter<CameraControl, PickResult>;

  /**
   * Event fired when a surface is double-picked.
   */
  readonly onDoublePickedSurface: EventEmitter<CameraControl, PickResult>;

  /**
   * Event fired when empty space is double-picked.
   */
  readonly onDoublePickedNothing: EventEmitter<CameraControl, PickResult>;

  /**
   * Event fired when snapping off a surface, vertex, or edge.
   */
  readonly onHoverSnapOrSurfaceOff: EventEmitter<CameraControl, any>;

  /**
   * Event fired when snapping onto a surface, vertex, or edge.
   */
  readonly onHoverSnapOrSurface: EventEmitter<CameraControl, any>;

  /**
   * Event fired when ray moves.
   */
  readonly onRayMove: EventEmitter<CameraControl, any>;

  _configs: {
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

  _states: {
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

  _updates: {
    panDeltaZ: number;
    panDeltaY: number;
    panDeltaX: number;
    rotateDeltaX: number;
    dollyDelta: number;
    rotateDeltaY: number;
  };

  _controllers: {
    pickController: any;
    cameraControl: any;
    pivotController: any;
    cameraFlight: any;
    panController: any;
  };

  _handlers: any[];
  _cameraUpdater: any;

  _keyMap: any;


  /**
   * @private
   *
   */
  constructor(view: View, cfg: CameraControlParams = {}) {

    this._keyMap = {}; // Maps key codes to the above actions

    this.view = view;

    this.view.htmlElement.oncontextmenu = (e) => {
      e.preventDefault();
    };

    // User-settable CameraControl configurations

    this._configs = {

      // Private

      longTapTimeout: 600, // Millisecs
      longTapRadius: 5, // Pixels

      // General

      active: true,
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

    this._states = {
      pointerCanvasPos: createVec2Float64(),
      mouseover: false,
      followPointerDirty: true,
      mouseDownClientX: 0,
      mouseDownClientY: 0,
      mouseDownCursorX: 0,
      mouseDownCursorY: 0,
      touchStartTime: null,
      activeTouches: [],
      tapStartPos: createVec2Float64(),
      tapStartTime: -1,
      lastTapTime: -1,
      longTouchTimeout: null
    };

    // Updates for CameraUpdater to process on next Scene "tick" event

    this._updates = {
      rotateDeltaX: 0,
      rotateDeltaY: 0,
      panDeltaX: 0,
      panDeltaY: 0,
      panDeltaZ: 0,
      dollyDelta: 0
    };

    // Controllers to assist input event handlers with controlling the Camera

    this._controllers = {
      cameraControl: this,
      pickController: new PickController(this, this._configs),
      pivotController: new PivotController(view, this._configs),
      panController: new PanController(view),
      cameraFlight: new CameraFlightAnimation(this.view, {
        duration: 0.5
      })
    };

    // Input event handlers

    this._handlers = [
      new MouseMiscHandler(this.view, this._controllers, this._configs, this._states, this._updates),
      new TouchPanRotateAndDollyHandler(this.view, this._controllers, this._configs, this._states, this._updates),
      new MousePanRotateDollyHandler(this.view, this._controllers, this._configs, this._states, this._updates),
      new KeyboardAxisViewHandler(this.view, this._controllers, this._configs, this._states, this._updates),
      new MousePickHandler(this.view, this._controllers, this._configs, this._states, this._updates),
      new TouchPickHandler(this.view, this._controllers, this._configs, this._states, this._updates),
      new KeyboardPanRotateDollyHandler(this.view, this._controllers, this._configs, this._states, this._updates)
    ];

    // Applies scheduled updates to the Camera on each Scene "tick" event

    this._cameraUpdater = new CameraUpdater(this.view, this._controllers, this._configs, this._states, this._updates);

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
    this.constrainVertical = cfg.constrainVertical;
    this.keyMap = cfg.keyMap;
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
  set keyMap(value: { Number: number } | number) {
    value = value || QWERTYLayout;
    if (isString(value)) {
      const keyMap = {};

      switch (value) {

        default:
          console.error("Unsupported value for 'keyMap': " + value + " defaulting to 'qwerty'");
        // Intentional fall-through to QWERTYLayout
        case QWERTYLayout:
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

      this._keyMap = keyMap;
    } else {
      const keyMap = value;
      this._keyMap = keyMap;
    }
  }

  /**
   * Gets custom mappings of keys to {@link CameraControl} actions.
   */
  get keyMap() {
    return this._keyMap;
  }

  /**
   * Returns true if any keys configured for the given action are down.
   * @param action
   * @param keyDownMap
   * @private
   */
  _isKeyDownForAction(action: number, keyDownMap: any) {
    // const keys = this._keyMap [action];
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
   * Sets the HTMl element to represent the pivot point when {@link CameraControl.followPointer} is true.
   *
   * See class comments for an example.
   */
  set pivotElement(element: HTMLElement) {
    this._controllers.pivotController.setPivotElement(element);
  }

  /**
   *  Sets if this ````CameraControl```` is active or not.
   *
   * When inactive, the ````CameraControl```` will not react to input.
   *
   * Default is ````true````.
   */
  set active(value: boolean) {
    value = value !== false;
    this._configs.active = value;
    this._handlers[1]._active = value;
    this._handlers[5]._active = value;
  }

  /**
   * Gets if this ````CameraControl```` is active or not.
   *
   * When inactive, the ````CameraControl```` will not react to input.
   *
   * Default is ````true````.
   *
   * @returns Returns ````true```` if this ````CameraControl```` is active.
   */
  get active(): boolean {
    return this._configs.active;
  }

  /**
   * Sets whether the pointer snap to vertex.
   */
  set snapToVertex(snapToVertex: boolean) {
    this._configs.snapToVertex = !!snapToVertex;
  }

  /**
   * Gets whether the pointer snap to vertex.
   */
  get snapToVertex(): boolean {
    return this._configs.snapToVertex;
  }

  /**
   * Sets whether the pointer snap to edge.
   */
  set snapToEdge(snapToEdge: boolean) {
    this._configs.snapToEdge = !!snapToEdge;
  }

  /**
   * Gets whether the pointer snap to edge.
   */
  get snapToEdge(): boolean {
    return this._configs.snapToEdge;
  }

  /**
   * Sets the current snap radius for "hoverSnapOrSurface" events, to specify whether the radius
   * within which the pointer snaps to the nearest vertex or the nearest edge.
   *
   * Default value is 30 pixels.
   */
  set snapRadius(snapRadius: number) {
    snapRadius = snapRadius || DEFAULT_SNAP_PICK_RADIUS;
    this._configs.snapRadius = snapRadius;
  }

  /**
   * Gets the current snap radius.
   */
  get snapRadius(): number {
    return this._configs.snapRadius;
  }

  /**
   * If `true`, the keyboard shortcuts are enabled ONLY if the mouse is over the canvas.
   */
  set keyboardEnabledOnlyIfMouseover(value: boolean) {
    this._configs.keyboardEnabledOnlyIfMouseover = !!value;
  }

  /**
   * Gets whether the keyboard shortcuts are enabled ONLY if the mouse is over the canvas or ALWAYS.
   */
  get keyboardEnabledOnlyIfMouseover(): boolean {
    return this._configs.keyboardEnabledOnlyIfMouseover;
  }

  /**
   * Gets the current navigation mode.
   *
   * Returned values are:
   *
   * * {@link constants!OrbitNavigationMode} - rotation orbits about the current target or pivot point,
   * * {@link constants!FirstPersonNavigationMode} - rotation is about the current eye position,
   * * {@link constants!PlanViewNavigationMode} - rotation is disabled.
   *
   * @returns The navigation mode: OrbitNavigationMode, FirstPersonNavigationMode or PlanViewNavigationMode.
   */
  get navMode(): number {
    return this._configs.navMode;
  }

  /**
   * Sets the current navigation mode.
   *
   * Accepted values are:
   *
   * * {@link constants!OrbitNavigationMode} - rotation orbits about the current target or pivot point,
   * * {@link constants!FirstPersonNavigationMode} - rotation is about the current eye position,
   * * {@link constants!PlanViewNavigationMode} - rotation is disabled.
   *
   * See class comments for more info.
   *
   * @param navMode The navigation mode: OrbitNavigationMode, FirstPersonNavigationMode or PlanViewNavigationMode.
   */
  set navMode(navMode: number | undefined) {
    navMode = navMode || OrbitNavigationMode;
    if (navMode !== FirstPersonNavigationMode && navMode !== OrbitNavigationMode && navMode !== PlanViewNavigationMode) {
      console.error("Unsupported value for navMode: " + navMode + " - supported values are 'orbit', 'firstPerson' and 'planView' - defaulting to 'orbit'");
      navMode = OrbitNavigationMode;
    }
    this._configs.firstPerson = (navMode === FirstPersonNavigationMode);
    this._configs.planView = (navMode === PlanViewNavigationMode);
    if (this._configs.firstPerson || this._configs.planView) {
      this._controllers.pivotController.hidePivot();
      this._controllers.pivotController.endPivot();
    }
    this._configs.navMode = navMode;
  }

  /**
   * Sets whether mouse and touch input is enabled.
   *
   * Default is ````true````.
   *
   * Disabling mouse and touch input on ````CameraControl```` is useful when we want to temporarily use mouse or
   * touch input to interact with some other 3D control, without disturbing the {@link viewer!Camera}.
   *
   * @param value Set ````true```` to enable mouse and touch input.
   */
  set pointerEnabled(value: boolean) {
    this._reset();
    this._configs.pointerEnabled = !!value;
  }

  _reset() {
    for (let i = 0, len = this._handlers.length; i < len; i++) {
      const handler = this._handlers[i];
      if (handler.reset) {
        handler.reset();
      }
    }
    this._updates.panDeltaX = 0;
    this._updates.panDeltaY = 0;
    this._updates.rotateDeltaX = 0;
    this._updates.rotateDeltaY = 0;
    this._updates.dollyDelta = 0;
  }

  /**
   * Gets whether mouse and touch input is enabled.
   *
   * Default is ````true````.
   *
   * Disabling mouse and touch input on ````CameraControl```` is desirable when we want to temporarily use mouse or
   * touch input to interact with some other 3D control, without interfering with the {@link viewer!Camera}.
   *
   * @returns Returns ````true```` if mouse and touch input is enabled.
   */
  get pointerEnabled(): boolean {
    return this._configs.pointerEnabled;
  }

  /**
   * Sets whether the {@link viewer!Camera} follows the mouse/touch pointer.
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
   * @param value Set ````true```` to enable the Camera to follow the pointer.
   */
  set followPointer(value: boolean) {
    this._configs.followPointer = (value !== false);
  }

  /**
   * Sets whether the {@link viewer!Camera} follows the mouse/touch pointer.
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
   * @returns Returns ````true```` if the Camera follows the pointer.
   */
  get followPointer(): boolean {
    return this._configs.followPointer;
  }

  /**
   * Sets the current World-space 3D target position.
   *
   * Only applies when {@link CameraControl.followPointer} is ````true````.
   *
   * @param worldPos The new World-space 3D target position.
   */
  set pivotPos(worldPos: Vec3) {
    this._controllers.pivotController.setPivotPos(worldPos);
  }

  /**
   * Gets the current World-space 3D pivot position.
   *
   * Only applies when {@link CameraControl.followPointer} is ````true````.
   *
   * @return  worldPos The current World-space 3D pivot position.
   */
  get pivotPos(): Vec3 {
    return this._controllers.pivotController.getPivotPos();
  }

  /**
   * Sets whether to vertically constrain the {@link viewer!Camera} position for first-person navigation.
   *
   * When set ````true````, this constrains {@link viewer!Camera_eye} to its current vertical position.
   *
   * Only applies when {@link CameraControl.navMode} is ````"firstPerson"````.
   *
   * Default is ````false````.
   *
   * @param value Set ````true```` to vertically constrain the Camera.
   */
  set constrainVertical(value: boolean) {
    this._configs.constrainVertical = !!value;
  }

  /**
   * Gets whether to vertically constrain the {@link viewer!Camera} position for first-person navigation.
   *
   * When set ````true````, this constrains {@link viewer!Camera_eye} to its current vertical position.
   *
   * Only applies when {@link CameraControl.navMode} is ````"firstPerson"````.
   *
   * Default is ````false````.
   *
   * @returns ````true```` when Camera is vertically constrained.
   */
  get constrainVertical(): boolean {
    return this._configs.constrainVertical;
  }

  /**
   * Sets whether double-picking an object causes the {@link viewer!Camera} to fly to its boundary.
   *
   * Default is ````false````.
   *
   * @param value Set ````true```` to enable double-pick-fly-to mode.
   */
  set doublePickFlyTo(value: boolean) {
    this._configs.doublePickFlyTo = value !== false;
  }

  /**
   * Gets whether double-picking an object causes the {@link viewer!Camera} to fly to its boundary.
   *
   * Default is ````false````.
   *
   * @returns Returns ````true```` when double-pick-fly-to mode is enabled.
   */
  get doublePickFlyTo(): boolean {
    return this._configs.doublePickFlyTo;
  }

  /**
   * Sets whether either right-clicking (true) or middle-clicking (false) pans the {@link viewer!Camera}.
   *
   * Default is ````true````.
   *
   * @param value Set ````false```` to disable pan on right-click.
   */
  set panRightClick(value: boolean) {
    this._configs.panRightClick = value !== false;
  }

  /**
   * Gets whether right-clicking pans the {@link viewer!Camera}.
   *
   * Default is ````true````.
   *
   * @returns Returns ````false```` when pan on right-click is disabled.
   */
  get panRightClick(): boolean {
    return this._configs.panRightClick;
  }

  /**
   * Sets a factor in range ````[0..1]```` indicating how much the {@link viewer!Camera} keeps moving after you finish rotating it.
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
   * Does not apply when {@link CameraControl.navMode} is ````"planView"````, which disallows rotation.
   *
   * @param rotationInertia New inertial factor.
   */
  set rotationInertia(rotationInertia: number) {
    this._configs.rotationInertia = (rotationInertia !== undefined && rotationInertia !== null) ? rotationInertia : 0.0;
  }

  /**
   * Gets the rotation inertia factor.
   *
   * Default is ````0.0````.
   *
   * Does not apply when {@link CameraControl.navMode} is ````"planView"````, which disallows rotation.
   *
   * @returns The inertia factor.
   */
  get rotationInertia(): number {
    return this._configs.rotationInertia;
  }

  /**
   * Sets how much the {@link viewer!Camera} pans each second with keyboard input.
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
   * @param keyboardPanRate The new keyboard pan rate.
   */
  set keyboardPanRate(keyboardPanRate: number) {
    this._configs.keyboardPanRate = (keyboardPanRate !== null && keyboardPanRate !== undefined) ? keyboardPanRate : 5.0;
  }


  /**
   * Sets how fast the camera pans on touch panning
   *
   * @param touchPanRate The new touch pan rate.
   */
  set touchPanRate(touchPanRate: number) {
    this._configs.touchPanRate = (touchPanRate !== null && touchPanRate !== undefined) ? touchPanRate : 1.0;
  }

  /**
   * Gets how fast the {@link viewer!Camera} pans on touch panning
   *
   * Default is ````1.0````.
   *
   * @returns The current touch pan rate.
   */
  get touchPanRate(): number {
    return this._configs.touchPanRate;
  }

  /**
   * Gets how much the {@link viewer!Camera} pans each second with keyboard input.
   *
   * Default is ````5.0````.
   *
   * @returns The current keyboard pan rate.
   */
  get keyboardPanRate(): number {
    return this._configs.keyboardPanRate;
  }

  /**
   * Sets how many degrees per second the {@link viewer!Camera} rotates/orbits with keyboard input.
   *
   * Default is ````90.0````, to rotate/orbit the Camera ````90.0```` degrees every second that
   * a rotation key is depressed. See the ````CameraControl```` class documentation for which keys control
   * rotation/orbit.
   *
   * @param keyboardRotationRate The new keyboard rotation rate.
   */
  set keyboardRotationRate(keyboardRotationRate: number) {
    this._configs.keyboardRotationRate = (keyboardRotationRate !== null && keyboardRotationRate !== undefined) ? keyboardRotationRate : 90.0;
  }

  /**
   * Sets how many degrees per second the {@link viewer!Camera} rotates/orbits with keyboard input.
   *
   * Default is ````90.0````.
   *
   * @returns The current keyboard rotation rate.
   */
  get keyboardRotationRate(): number {
    return this._configs.keyboardRotationRate;
  }

  /**
   * Sets the current drag rotation rate.
   *
   * This configures how many degrees the {@link viewer!Camera} rotates/orbits for a full sweep of the canvas by mouse or touch dragging.
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
   * @param dragRotationRate The new drag rotation rate.
   */
  set dragRotationRate(dragRotationRate: number) {
    this._configs.dragRotationRate = (dragRotationRate !== null && dragRotationRate !== undefined) ? dragRotationRate : 360.0;
  }

  /**
   * Gets the current drag rotation rate.
   *
   * Default is ````360.0````.
   *
   * @returns The current drag rotation rate.
   */
  get dragRotationRate(): number {
    return this._configs.dragRotationRate;
  }

  /**
   * Sets how much the {@link viewer!Camera} dollys each second with keyboard input.
   *
   * Default is ````15.0````, to dolly the {@link viewer!Camera} ````15.0```` World-space units per second while we hold down
   * the ````+```` and ````-```` keys.
   *
   * @param keyboardDollyRate The new keyboard dolly rate.
   */
  set keyboardDollyRate(keyboardDollyRate: number) {
    this._configs.keyboardDollyRate = (keyboardDollyRate !== null && keyboardDollyRate !== undefined) ? keyboardDollyRate : 15.0;
  }

  /**
   * Gets how much the {@link viewer!Camera} dollys each second with keyboard input.
   *
   * Default is ````15.0````.
   *
   * @returns The current keyboard dolly rate.
   */
  get keyboardDollyRate(): number {
    return this._configs.keyboardDollyRate;
  }

  /**
   * Sets how much the {@link viewer!Camera} dollys with touch input.
   *
   * Default is ````0.2````
   *
   * @param touchDollyRate The new touch dolly rate.
   */
  set touchDollyRate(touchDollyRate: number) {
    this._configs.touchDollyRate = (touchDollyRate !== null && touchDollyRate !== undefined) ? touchDollyRate : 0.2;
  }

  /**
   * Gets how much the {@link viewer!Camera} dollys each second with touch input.
   *
   * Default is ````0.2````.
   *
   * @returns The current touch dolly rate.
   */
  get touchDollyRate(): number {
    return this._configs.touchDollyRate;
  }

  /**
   * Sets how much the {@link viewer!Camera} dollys each second while the mouse wheel is spinning.
   *
   * Default is ````100.0````, to dolly the {@link viewer!Camera} ````10.0```` World-space units per second as we spin
   * the mouse wheel.
   *
   * @param mouseWheelDollyRate The new mouse wheel dolly rate.
   */
  set mouseWheelDollyRate(mouseWheelDollyRate: number) {
    this._configs.mouseWheelDollyRate = (mouseWheelDollyRate !== null && mouseWheelDollyRate !== undefined) ? mouseWheelDollyRate : 100.0;
  }

  /**
   * Gets how much the {@link viewer!Camera} dollys each second while the mouse wheel is spinning.
   *
   * Default is ````100.0````.
   *
   * @returns The current mouseWheel dolly rate.
   */
  get mouseWheelDollyRate(): number {
    return this._configs.mouseWheelDollyRate;
  }

  /**
   * Sets the dolly inertia factor.
   *
   * This factor configures how much the {@link viewer!Camera} keeps moving after you finish dollying it.
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
   * @param dollyInertia New dolly inertia factor.
   */
  set dollyInertia(dollyInertia: number) {
    this._configs.dollyInertia = (dollyInertia !== undefined && dollyInertia !== null) ? dollyInertia : 0;
  }

  /**
   * Gets the dolly inertia factor.
   *
   * Default is ````0````.
   *
   * @returns The current dolly inertia factor.
   */
  get dollyInertia(): number {
    return this._configs.dollyInertia;
  }

  /**
   * Sets the proximity to the closest object below which dolly speed decreases, and above which dolly speed increases.
   *
   * Default is ````35.0````.
   *
   * @param dollyProximityThreshold New dolly proximity threshold.
   */
  set dollyProximityThreshold(dollyProximityThreshold: number) {
    this._configs.dollyProximityThreshold = (dollyProximityThreshold !== undefined && dollyProximityThreshold !== null) ? dollyProximityThreshold : 35.0;
  }

  /**
   * Gets the proximity to the closest object below which dolly speed decreases, and above which dolly speed increases.
   *
   * Default is ````35.0````.
   *
   * @returns The current dolly proximity threshold.
   */
  get dollyProximityThreshold(): number {
    return this._configs.dollyProximityThreshold;
  }

  /**
   * Sets the minimum dolly speed.
   *
   * Default is ````0.04````.
   *
   * @param dollyMinSpeed New dolly minimum speed.
   */
  set dollyMinSpeed(dollyMinSpeed: number) {
    this._configs.dollyMinSpeed = (dollyMinSpeed !== undefined && dollyMinSpeed !== null) ? dollyMinSpeed : 0.04;
  }

  /**
   * Gets the minimum dolly speed.
   *
   * Default is ````0.04````.
   *
   * @returns The current minimum dolly speed.
   */
  get dollyMinSpeed(): number {
    return this._configs.dollyMinSpeed;
  }

  /**
   * Sets the pan inertia factor.
   *
   * This factor configures how much the {@link viewer!Camera} keeps moving after you finish panning it.
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
   * @param panInertia New pan inertia factor.
   */
  set panInertia(panInertia: number) {
    this._configs.panInertia = (panInertia !== undefined && panInertia !== null) ? panInertia : 0.5;
  }

  /**
   * Gets the pan inertia factor.
   *
   * Default is ````0.5````.
   *
   * @returns The current pan inertia factor.
   */
  get panInertia(): number {
    return this._configs.panInertia;
  }

  /**
   * Sets a sphere as the representation of the pivot position.
   *
   * @param [cfg] Sphere configuration.
   */
  enablePivotSphere(cfg = {}) {
    this._controllers.pivotController.enablePivotSphere(cfg);
  }

  /**
   * Remove the sphere as the representation of the pivot position.
   */
  disablePivotSphere() {
    this._controllers.pivotController.disablePivotSphere();
  }

  /**
   * Sets whether smart default pivoting is enabled.
   *
   * When ````true````, we'll pivot by default about the 3D position of the mouse/touch pointer on an
   * imaginary sphere that's centered at {@link viewer!Camera_eye} and sized to the {@link scene!Scene} boundary.
   *
   * When ````false````, we'll pivot by default about {@link viewer!Camera_look}.
   *
   * Default is ````false````.
   *
   * @param enabled Set ````true```` to pivot by default about the selected point on the virtual sphere, or ````false```` to pivot by default about {@link viewer!Camera_look}.
   */
  set smartPivot(enabled: boolean) {
    this._configs.smartPivot = (enabled !== false);
  }

  /**
   * Gets whether smart default pivoting is enabled.
   *
   * When ````true````, we'll pivot by default about the 3D position of the mouse/touch pointer on an
   * imaginary sphere that's centered at {@link viewer!Camera_eye} and sized to the {@link scene!Scene} boundary.
   *
   * When ````false````, we'll pivot by default about {@link viewer!Camera_look}.
   *
   * Default is ````false````.
   *
   * @returns Returns ````true```` when pivoting by default about the selected point on the virtual sphere, or ````false```` when pivoting by default about {@link viewer!Camera_look}.
   */
  get smartPivot(): boolean {
    return this._configs.smartPivot;
  }

  /**
   * Sets the double click time frame length in milliseconds.
   *
   * If two mouse click events occur within this time frame, it is considered a double click.
   *
   * Default is ````250````
   *
   * @param value New double click time frame.
   */
  set doubleClickTimeFrame(value: number) {
    this._configs.doubleClickTimeFrame = (value !== undefined && value !== null) ? value : 250;
  }

  /**
   * Gets the double click time frame length in milliseconds.
   *
   * Default is ````250````
   *
   * @returns Current double click time frame.
   */
  get doubleClickTimeFrame(): number {
    return this._configs.doubleClickTimeFrame;
  }

  /**
   * Destroys this ````CameraControl````.
   * @private
   */
  destroy() {
    this._destroyHandlers();
    this._destroyControllers();
    this._cameraUpdater.destroy();
  }

  _destroyHandlers() {
    for (let i = 0, len = this._handlers.length; i < len; i++) {
      const handler = this._handlers[i];
      if (handler.destroy) {
        handler.destroy();
      }
    }
  }

  _destroyControllers() {
    for (const key in this._controllers) {
      const controller = this._controllers[key];
      if (controller.destroy) {
        controller.destroy();
      }
    }
  }
}

