import {Component} from '../../Component';

import {CameraFlightAnimation} from '../camera/CameraFlightAnimation';
import {PanController} from "./lib/controllers/PanController";
import {PivotController} from "./lib/controllers/PivotController";
import {PickController} from "./lib/controllers/PickController";
import {MousePanRotateDollyHandler} from "./lib/handlers/MousePanRotateDollyHandler";
import {KeyboardAxisViewHandler} from "./lib/handlers/KeyboardAxisViewHandler";
import {MousePickHandler} from "./lib/handlers/MousePickHandler";
import {KeyboardPanRotateDollyHandler} from "./lib/handlers/KeyboardPanRotateDollyHandler";
import {CameraUpdater} from "./lib/CameraUpdater";
import {MouseMiscHandler} from "./lib/handlers/MouseMiscHandler";
import {TouchPanRotateAndDollyHandler} from "./lib/handlers/TouchPanRotateAndDollyHandler";
import {TouchPickHandler} from "./lib/handlers/TouchPickHandler";

import * as utils from "../../utils/index";
import * as math from "../../math/index";
import type {View} from "../View";
import type {Canvas} from "../Canvas";
import type {Camera} from "../camera/index";
import type {Scene} from "../../scene/Scene";

/**
 * Controls a {@link Camera} with user input.
 *
 * ## Summary
 *
 * * Controls the {@link Camera} belonging to its {@link View}
 * * Reads touch, mouse and keyboard input
 * * Located at {@link View.cameraControl}
 * * Three navigation modes: "orbit", "firstPerson" and "planView"
 * * Dynamic key mapping
 * * Smart-pivot
 * * Move-to-pointer
 * * Distance-scaled rate of movement
 * * Inertia
 */
class CameraControl extends Component {

    /**
     * Identifies the *leftwards panning* action, in which the {@link Camera} moves leftwards along its local axis.
     */
    public static readonly PAN_LEFT: number = 0;

    /**
     * Identifies the *rightwards panning* action, in which the {@link Camera} moves rightwards along its local axis.
     */
    public static readonly PAN_RIGHT: number = 1;

    /**
     * Identifies the *upwards panning* action, in which the {@link Camera} moves upwards along its local vertical axis.
     */
    public static readonly PAN_UP: number = 2;

    /**
     * Identifies the *downwards panning* action, in which the {@link Camera} moves downwards along its local vertical axis.
     */
    public static readonly PAN_DOWN: number = 3;

    /**
     * Identifies the *forwards panning* action, in which the {@link Camera} advances forwards along its current view direction.
     */
    public static readonly PAN_FORWARDS: number = 4;

    /**
     * Identifies the *backwards panning* action, in which the {@link Camera} retreats backwards along its current view direction.
     */
    public static readonly PAN_BACKWARDS: number = 5;

    /**
     * Identifies the *positive-rotation-about-X-axis* action.
     */
    public static readonly ROTATE_X_POS: number = 6;

    /**
     * Identifies the *negative-rotation-about-X-axis* action.
     */
    public static readonly ROTATE_X_NEG: number = 7;

    /**
     * Identifies the *positive-rotation-about-Y-axis* action.
     */
    public static readonly ROTATE_Y_POS: number = 8;

    /**
     * Identifies the *negative-rotation-about-Y-axis* action.
     */
    public static readonly ROTATE_Y_NEG: number = 9;

    /**
     * Identifies the *dolly forwards* action.
     */
    public static readonly DOLLY_FORWARDS: number = 10;

    /**
     * Identifies the *dolly backwards* action.
     */
    public static readonly DOLLY_BACKWARDS: number = 11;

    /**
     * Identifies the *axis-view-right* action.
     */
    public static readonly AXIS_VIEW_RIGHT: number = 12;

    /**
     * Identifies the *axis-view-back* action.
     */
    public static readonly AXIS_VIEW_BACK: number = 13;

    /**
     * Identifies the *axis-view-left* action.
     */
    public static readonly AXIS_VIEW_LEFT: number = 14;

    /**
     * Identifies the *axis-view-front* action.
     */
    public static readonly AXIS_VIEW_FRONT: number = 15;

    /**
     * Identifies the *axis-view-top* action.
     */
    public static readonly AXIS_VIEW_TOP: number = 16;

    /**
     * Identifies the *axis-view-bottom* action.
     */
    public static readonly AXIS_VIEW_BOTTOM: number = 17;

    /**
     * The View that owns this CameraControl.
     */
    public readonly view: View;

    /**
     * The Canvas where this CameraContol listens for input.
     */
    public readonly canvas: Canvas;

    /**
     * The Camera this CameraControl controls.
     */
    public readonly camera: Camera;

    readonly #components: {
        view: View;
        canvas: Canvas;
        camera: Camera;
    };

    readonly #configs: {
        rotationInertia: number;
        mouseWheelDollyRate: number;
        keyboardPanRate: number;
        touchPanRate: number;
        pointerEnabled: boolean;
        dollyProximityThreshold: number;
        keyboardRotationRate: number;
        planView: boolean;
        keyboardLayout: string;
        constrainVertical: boolean;
        touchDollyRate: number;
        dragRotationRate: number;
        firstPerson: boolean;
        active: boolean;
        longTapRadius: number;
        dollyMinSpeed: number;
        panInertia: number;
        followPointer: boolean;
        showPivot: boolean;
        navMode: string;
        longTapTimeout: number;
        keyboardDollyRate: number;
        dollyInertia: number;
        panRightClick: boolean;
        smartPivot: boolean;
        doublePickFlyTo: boolean
    };

    readonly #states: {
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
        touchStartTime: null
    };

    readonly #updates: {
        panDeltaZ: number;
        panDeltaY: number;
        panDeltaX: number;
        rotateDeltaX: number;
        dollyDelta: number;
        rotateDeltaY: number
    };

    readonly #controllers: {
        pickController: PickController;
        cameraControl: CameraControl;
        pivotController: PivotController;
        cameraFlight: CameraFlightAnimation; panController: PanController
    };

    readonly #handlers: (
        MouseMiscHandler |
        TouchPanRotateAndDollyHandler |
        MousePanRotateDollyHandler |
        KeyboardAxisViewHandler |
        MousePickHandler | TouchPickHandler | KeyboardPanRotateDollyHandler)[];

    readonly #cameraUpdater: CameraUpdater;

    #keyMap: { [key: number]: any };

    /**
     * @private
     */
    constructor(view: View, canvas: Canvas, camera: Camera, cfg: {
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
        keyMap?: {};
        keyboardLayout?: any;
        constrainVertical?: boolean;
        planView?: any;
        navMode?: string;
        doublePickFlyTo?: boolean
    }) {

        super(view, cfg);

        this.view = view;
        this.canvas = canvas;
        this.camera = camera;

        this.#keyMap = {}; // Maps key codes to the above actions

        canvas.canvas.oncontextmenu = (e) => {
            e.preventDefault();
        };

        this.#components = {
            view,
            canvas,
            camera
        }

        this.#configs = {
            longTapTimeout: 600, // Millisecs
            longTapRadius: 5, // Pixels
            active: true,
            keyboardLayout: "qwerty",
            navMode: "orbit",
            planView: false,
            firstPerson: false,
            followPointer: true,
            doublePickFlyTo: true,
            panRightClick: true,
            showPivot: false,
            pointerEnabled: true,
            constrainVertical: false,
            smartPivot: false,
            dragRotationRate: 360.0,
            keyboardRotationRate: 90.0,
            rotationInertia: 0.0,
            keyboardPanRate: 1.0,
            touchPanRate: 1.0,
            panInertia: 0.5,
            keyboardDollyRate: 10,
            mouseWheelDollyRate: 100,
            touchDollyRate: 0.2,
            dollyInertia: 0,
            dollyProximityThreshold: 30.0,
            dollyMinSpeed: 0.04
        };

        this.#states = {
            pointerCanvasPos: math.vec2(),
            mouseover: false,
            followPointerDirty: true,
            mouseDownClientX: 0,
            mouseDownClientY: 0,
            mouseDownCursorX: 0,
            mouseDownCursorY: 0,
            touchStartTime: null,
            activeTouches: [],
            tapStartPos: math.vec2(),
            tapStartTime: -1,
            lastTapTime: -1,
            longTouchTimeout: null
        };

        this.#updates = {
            rotateDeltaX: 0,
            rotateDeltaY: 0,
            panDeltaX: 0,
            panDeltaY: 0,
            panDeltaZ: 0,
            dollyDelta: 0
        };

        this.#controllers = {
            cameraControl: this,
            pickController: new PickController(this, this.#configs),
            pivotController: new PivotController(this, this.#configs),
            panController: new PanController(this),
            cameraFlight: new CameraFlightAnimation(this.view,{
                duration: 0.5
            })
        };

        this.#handlers = [
            new MouseMiscHandler(this.#components, this.#controllers, this.#configs, this.#states, this.#updates),
            new TouchPanRotateAndDollyHandler(this.#components, this.#controllers, this.#configs, this.#states, this.#updates),
            new MousePanRotateDollyHandler(this.#components, this.#controllers, this.#configs, this.#states, this.#updates),
            new KeyboardAxisViewHandler(this.#components, this.#controllers, this.#configs, this.#states, this.#updates),
            new MousePickHandler(this.#components, this.#controllers, this.#configs, this.#states, this.#updates),
            new TouchPickHandler(this.#components, this.#controllers, this.#configs, this.#states, this.#updates),
            new KeyboardPanRotateDollyHandler(this.#components, this.#controllers, this.#configs, this.#states, this.#updates)
        ];

        // Applies scheduled updates to the Camera on each Scene "tick" event

        this.#cameraUpdater = new CameraUpdater(this, this.#controllers, this.#configs, this.#states, this.#updates);

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
     * Gets custom mappings of keys to {@link CameraControl} actions.
     *
     * @returns Current key mappings.
     */
    get keyMap(): { [key: number]: number } {
        return this.#keyMap;
    }

    /**
     * Sets custom mappings of keys to ````CameraControl```` actions.
     *
     * See class docs for usage.
     *
     * @param value Either a set of new key mappings, or a string to select a keyboard layout,
     * which causes ````CameraControl```` to use the default key mappings for that layout.
     */
    set keyMap(value: { [key: number]: number } | string|undefined) {
        value = value || "qwerty";
        if (utils.isString(value)) {
            const input = this.view.input;
            const keyMap: { [key: number]: any } = {};

            switch (value) {

                default:
                    this.error("Unsupported value for 'keyMap': " + value + " defaulting to 'qwerty'");
                // Intentional fall-through to "qwerty"
                case "qwerty":
                    keyMap[CameraControl.PAN_LEFT] = [input.KEY_A];
                    keyMap[CameraControl.PAN_RIGHT] = [input.KEY_D];
                    keyMap[CameraControl.PAN_UP] = [input.KEY_Z];
                    keyMap[CameraControl.PAN_DOWN] = [input.KEY_X];
                    keyMap[CameraControl.PAN_BACKWARDS] = [];
                    keyMap[CameraControl.PAN_FORWARDS] = [];
                    keyMap[CameraControl.DOLLY_FORWARDS] = [input.KEY_W, input.KEY_ADD];
                    keyMap[CameraControl.DOLLY_BACKWARDS] = [input.KEY_S, input.KEY_SUBTRACT];
                    keyMap[CameraControl.ROTATE_X_POS] = [input.KEY_DOWN_ARROW];
                    keyMap[CameraControl.ROTATE_X_NEG] = [input.KEY_UP_ARROW];
                    keyMap[CameraControl.ROTATE_Y_POS] = [input.KEY_Q, input.KEY_LEFT_ARROW];
                    keyMap[CameraControl.ROTATE_Y_NEG] = [input.KEY_E, input.KEY_RIGHT_ARROW];
                    keyMap[CameraControl.AXIS_VIEW_RIGHT] = [input.KEY_NUM_1];
                    keyMap[CameraControl.AXIS_VIEW_BACK] = [input.KEY_NUM_2];
                    keyMap[CameraControl.AXIS_VIEW_LEFT] = [input.KEY_NUM_3];
                    keyMap[CameraControl.AXIS_VIEW_FRONT] = [input.KEY_NUM_4];
                    keyMap[CameraControl.AXIS_VIEW_TOP] = [input.KEY_NUM_5];
                    keyMap[CameraControl.AXIS_VIEW_BOTTOM] = [input.KEY_NUM_6];
                    break;

                case "azerty":
                    keyMap[CameraControl.PAN_LEFT] = [input.KEY_Q];
                    keyMap[CameraControl.PAN_RIGHT] = [input.KEY_D];
                    keyMap[CameraControl.PAN_UP] = [input.KEY_W];
                    keyMap[CameraControl.PAN_DOWN] = [input.KEY_X];
                    keyMap[CameraControl.PAN_BACKWARDS] = [];
                    keyMap[CameraControl.PAN_FORWARDS] = [];
                    keyMap[CameraControl.DOLLY_FORWARDS] = [input.KEY_Z, input.KEY_ADD];
                    keyMap[CameraControl.DOLLY_BACKWARDS] = [input.KEY_S, input.KEY_SUBTRACT];
                    keyMap[CameraControl.ROTATE_X_POS] = [input.KEY_DOWN_ARROW];
                    keyMap[CameraControl.ROTATE_X_NEG] = [input.KEY_UP_ARROW];
                    keyMap[CameraControl.ROTATE_Y_POS] = [input.KEY_A, input.KEY_LEFT_ARROW];
                    keyMap[CameraControl.ROTATE_Y_NEG] = [input.KEY_E, input.KEY_RIGHT_ARROW];
                    keyMap[CameraControl.AXIS_VIEW_RIGHT] = [input.KEY_NUM_1];
                    keyMap[CameraControl.AXIS_VIEW_BACK] = [input.KEY_NUM_2];
                    keyMap[CameraControl.AXIS_VIEW_LEFT] = [input.KEY_NUM_3];
                    keyMap[CameraControl.AXIS_VIEW_FRONT] = [input.KEY_NUM_4];
                    keyMap[CameraControl.AXIS_VIEW_TOP] = [input.KEY_NUM_5];
                    keyMap[CameraControl.AXIS_VIEW_BOTTOM] = [input.KEY_NUM_6];
                    break;
            }

            this.#keyMap = keyMap;
        } else {
            const keyMap = value;
            this.#keyMap = keyMap;
        }
    }

    /**
     * Sets the HTMl element to represent the pivot point when {@link CameraControl.followPointer} is true.
     *
     * See class comments for an example.
     *
     * @param  element HTML element representing the pivot point.
     */
    set pivotElement(element: HTMLElement) {
        this.#controllers.pivotController.setPivotElement(element);
    }

    /**
     * Gets if this ````CameraControl```` is active or not.
     *
     * When inactive, the ````CameraControl```` will not react to input.
     *
     * Default is ````true````.
     *
     * @returns ````true```` if this ````CameraControl```` is active.
     */
    get active(): boolean {
        return this.#configs.active;
    }

    /**
     *  Sets if this ````CameraControl```` is active or not.
     *
     * When inactive, the ````CameraControl```` will not react to input.
     *
     * Default is ````true````.
     *
     * @param value Set ````true```` to activate this ````CameraControl````.
     */
    set active(value: boolean|undefined) {
        this.#configs.active = value !== false;
    }

    /**
     * Gets the current navigation mode.
     *
     * @returns {String} The navigation mode: "orbit", "firstPerson" or "planView".
     */
    get navMode(): string {
        return this.#configs.navMode;
    }

    /**
     * Sets the current navigation mode.
     *
     * Accepted values are:
     *
     * * "orbit" - rotation orbits about the current target or pivot point,
     * * "firstPerson" - rotation is about the current eye position,
     * * "planView" - rotation is disabled.
     *
     * See class comments for more info.
     *
     * @param navMode The navigation mode: "orbit", "firstPerson" or "planView".
     */
    set navMode(navMode: string|undefined) {
        navMode = navMode || "orbit";
        if (navMode !== "firstPerson" && navMode !== "orbit" && navMode !== "planView") {
            this.error("Unsupported value for navMode: " + navMode + " - supported values are 'orbit', 'firstPerson' and 'planView' - defaulting to 'orbit'");
            navMode = "orbit";
        }
        this.#configs.firstPerson = (navMode === "firstPerson");
        this.#configs.planView = (navMode === "planView");
        if (this.#configs.firstPerson || this.#configs.planView) {
            this.#controllers.pivotController.hidePivot();
            this.#controllers.pivotController.endPivot();
        }
        this.#configs.navMode = navMode;
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
    get pointerEnabled(): boolean {
        return this.#configs.pointerEnabled;
    }

    /**
     * Sets whether mouse and touch input is enabled.
     *
     * Default is ````true````.
     *
     * Disabling mouse and touch input on ````CameraControl```` is useful when we want to temporarily use mouse or
     * touch input to interact with some other 3D control, without disturbing the {@link Camera}.
     *
     * @param value Set ````true```` to enable mouse and touch input.
     */
    set pointerEnabled(value: boolean) {
        this.#reset();
        this.#configs.pointerEnabled = !!value;
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
    get followPointer(): boolean {
        return this.#configs.followPointer;
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
     * @param value Set ````true```` to enable the Camera to follow the pointer.
     */
    set followPointer(value: boolean|undefined) {
        this.#configs.followPointer = (value !== false);
    }

    /**
     * Gets the current World-space 3D pivot position.
     *
     * Only applies when {@link CameraControl.followPointer} is ````true````.
     *
     * @return {Number[]} worldPos The current World-space 3D pivot position.
     */
    get pivotPos(): math.FloatArrayParam {
        return this.#controllers.pivotController.getPivotPos();
    }

    /**
     * Sets the current World-space 3D target position.
     *
     * Only applies when {@link CameraControl.followPointer} is ````true````.
     *
     * @param worldPos The new World-space 3D target position.
     */
    set pivotPos(worldPos: math.FloatArrayParam) {
        this.#controllers.pivotController.setPivotPos(worldPos);
    }

    /**
     * @deprecated
     * @returns {Boolean} Returns ````true```` if dolly-to-pointer behaviour is enabled.
     */
    get dollyToPointer(): boolean {
        this.warn("dollyToPointer property is deprecated - replaced with followPointer");
        return this.followPointer;
    }

    /**
     * @deprecated
     * @param value Set ````true```` to enable dolly-to-pointer behaviour.
     */
    set dollyToPointer(value: boolean) {
        this.warn("dollyToPointer property is deprecated - replaced with followPointer");
        this.followPointer = value;
    }

    /**
     * @deprecated
     * @returns {Boolean} Returns ````true```` if dolly-to-pointer behaviour is enabled.
     */
    get panToPointer(): boolean {
        this.warn("panToPointer property is deprecated - replaced with followPointer");
        return false;
    }

    /**
     * @deprecated
     * @param value Set ````true```` to enable dolly-to-pointer behaviour.
     */
    set panToPointer(value: boolean) {
        this.warn("panToPointer property is deprecated - replaced with followPointer");
    }

    /**
     * Gets whether this ````CameraControl```` is in plan-view mode.
     *
     * When in plan-view mode, rotation is disabled.
     *
     * Default is ````false````.
     *
     * Deprecated - use {@link CameraControl.navMode} instead.
     *
     * @returns {Boolean} Returns ````true```` if plan-view mode is enabled.
     * @deprecated
     */
    get planView(): boolean {
        this.warn("planView property is deprecated - replaced with navMode");
        return this.#configs.planView;
    }

    /**
     * Sets whether this ````CameraControl```` is in plan-view mode.
     *
     * When in plan-view mode, rotation is disabled.
     *
     * Default is ````false````.
     *
     * Deprecated - use {@link CameraControl.navMode} instead.
     *
     * @param value Set ````true```` to enable plan-view mode.
     * @deprecated
     */
    set planView(value: boolean) {
        this.#configs.planView = !!value;
        this.#configs.firstPerson = false;
        if (this.#configs.planView) {
            this.#controllers.pivotController.hidePivot();
            this.#controllers.pivotController.endPivot();
        }
        this.warn("planView property is deprecated - replaced with navMode");
    }

    /**
     * Gets whether this ````CameraControl```` is in first-person mode.
     *
     * In "first person" mode (disabled by default) the look position rotates about the eye position. Otherwise,  {@link Camera.eye} rotates about {@link Camera.look}.
     *
     * Default is ````false````.
     *
     * Deprecated - use {@link CameraControl.navMode} instead.
     *
     * @returns {Boolean} Returns ````true```` if first-person mode is enabled.
     * @deprecated
     */
    get firstPerson(): boolean {
        this.warn("firstPerson property is deprecated - replaced with navMode");
        return this.#configs.firstPerson;
    }

    /**
     * Sets whether this ````CameraControl```` is in first-person mode.
     *
     * In "first person" mode (disabled by default) the look position rotates about the eye position. Otherwise,  {@link Camera.eye} rotates about {@link Camera.look}.
     *
     * Default is ````false````.
     *
     * Deprecated - use {@link CameraControl.navMode} instead.
     *
     * @param value Set ````true```` to enable first-person mode.
     * @deprecated
     */
    set firstPerson(value: boolean) {
        this.warn("firstPerson property is deprecated - replaced with navMode");
        this.#configs.firstPerson = !!value;
        this.#configs.planView = false;
        if (this.#configs.firstPerson) {
            this.#controllers.pivotController.hidePivot();
            this.#controllers.pivotController.endPivot();
        }
    }

    /**
     * Gets whether to vertically constrain the {@link Camera} position for first-person navigation.
     *
     * When set ````true````, this constrains {@link Camera.eye} to its current vertical position.
     *
     * Only applies when {@link CameraControl.navMode} is ````"firstPerson"````.
     *
     * Default is ````false````.
     *
     * @returns {Boolean} ````true```` when Camera is vertically constrained.
     */
    get constrainVertical(): boolean {
        return this.#configs.constrainVertical;
    }

    /**
     * Sets whether to vertically constrain the {@link Camera} position for first-person navigation.
     *
     * When set ````true````, this constrains {@link Camera.eye} to its current vertical position.
     *
     * Only applies when {@link CameraControl.navMode} is ````"firstPerson"````.
     *
     * Default is ````false````.
     *
     * @param value Set ````true```` to vertically constrain the Camera.
     */
    set constrainVertical(value: boolean|undefined) {
        this.#configs.constrainVertical = !!value;
    }

    /**
     * Gets whether double-picking an {@link Entity} causes the {@link Camera} to fly to its boundary.
     *
     * Default is ````false````.
     *
     * @returns {Boolean} Returns ````true```` when double-pick-fly-to mode is enabled.
     */
    get doublePickFlyTo(): boolean {
        return this.#configs.doublePickFlyTo;
    }

    /**
     * Sets whether double-picking an {@link Entity} causes the {@link Camera} to fly to its boundary.
     *
     * Default is ````false````.
     *
     * @param value Set ````true```` to enable double-pick-fly-to mode.
     */
    set doublePickFlyTo(value: boolean|undefined) {
        this.#configs.doublePickFlyTo = value !== false;
    }

    /**
     * Gets whether right-clicking pans the {@link Camera}.
     *
     * Default is ````true````.
     *
     * @returns {Boolean} Returns ````false```` when pan on right-click is disabled.
     */
    get panRightClick(): boolean {
        return this.#configs.panRightClick;
    }

    /**
     * Sets whether either right-clicking (true) or middle-clicking (false) pans the {@link Camera}.
     *
     * Default is ````true````.
     *
     * @param value Set ````false```` to disable pan on right-click.
     */
    set panRightClick(value: boolean|undefined) {
        this.#configs.panRightClick = value !== false;
    }

    /**
     * Gets the rotation inertia factor.
     *
     * Default is ````0.0````.
     *
     * Does not apply when {@link CameraControl.navMode} is ````"planView"````, which disallows rotation.
     *
     * @returns {Number} The inertia factor.
     */
    get rotationInertia(): number {
        return this.#configs.rotationInertia;
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
     * Does not apply when {@link CameraControl.navMode} is ````"planView"````, which disallows rotation.
     *
     * @param rotationInertia New inertial factor.
     */
    set rotationInertia(rotationInertia: number|undefined) {
        this.#configs.rotationInertia = (rotationInertia !== undefined && rotationInertia !== null) ? rotationInertia : 0.0;
    }

    /**
     * Gets how fast the {@link Camera} pans on touch panning
     *
     * Default is ````1.0````.
     *
     * @returns {Number} The current touch pan rate.
     */
    get touchPanRate(): number {
        return this.#configs.touchPanRate;
    }

    /**
     * Sets how fast the camera pans on touch panning
     *
     * @param touchPanRate The new touch pan rate.
     */
    set touchPanRate(touchPanRate: number|undefined) {
        this.#configs.touchPanRate = (touchPanRate !== null && touchPanRate !== undefined) ? touchPanRate : 1.0;
    }

    /**
     * Gets how much the {@link Camera} pans each second with keyboard input.
     *
     * Default is ````5.0````.
     *
     * @returns {Number} The current keyboard pan rate.
     */
    get keyboardPanRate(): number {
        return this.#configs.keyboardPanRate;
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
     * @param keyboardPanRate The new keyboard pan rate.
     */
    set keyboardPanRate(keyboardPanRate: number|undefined) {
        this.#configs.keyboardPanRate = (keyboardPanRate !== null && keyboardPanRate !== undefined) ? keyboardPanRate : 5.0;
    }

    /**
     * Sets how many degrees per second the {@link Camera} rotates/orbits with keyboard input.
     *
     * Default is ````90.0````.
     *
     * @returns {Number} The current keyboard rotation rate.
     */
    get keyboardRotationRate(): number {
        return this.#configs.keyboardRotationRate;
    }

    /**
     * Sets how many degrees per second the {@link Camera} rotates/orbits with keyboard input.
     *
     * Default is ````90.0````, to rotate/orbit the Camera ````90.0```` degrees every second that
     * a rotation key is depressed. See the ````CameraControl```` class documentation for which keys control
     * rotation/orbit.
     *
     * @param keyboardRotationRate The new keyboard rotation rate.
     */
    set keyboardRotationRate(keyboardRotationRate: number|undefined) {
        this.#configs.keyboardRotationRate = (keyboardRotationRate !== null && keyboardRotationRate !== undefined) ? keyboardRotationRate : 90.0;
    }

    /**
     * Gets the current drag rotation rate.
     *
     * Default is ````360.0````.
     *
     * @returns {Number} The current drag rotation rate.
     */
    get dragRotationRate(): number {
        return this.#configs.dragRotationRate;
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
     * @param dragRotationRate The new drag rotation rate.
     */
    set dragRotationRate(dragRotationRate: number|undefined) {
        this.#configs.dragRotationRate = (dragRotationRate !== null && dragRotationRate !== undefined) ? dragRotationRate : 360.0;
    }

    /**
     * Gets how much the {@link Camera} dollys each second with keyboard input.
     *
     * Default is ````15.0````.
     *
     * @returns {Number} The current keyboard dolly rate.
     */
    get keyboardDollyRate(): number {
        return this.#configs.keyboardDollyRate;
    }

    /**
     * Sets how much the {@link Camera} dollys each second with keyboard input.
     *
     * Default is ````15.0````, to dolly the {@link Camera} ````15.0```` World-space units per second while we hold down
     * the ````+```` and ````-```` keys.
     *
     * @param keyboardDollyRate The new keyboard dolly rate.
     */
    set keyboardDollyRate(keyboardDollyRate: number|undefined) {
        this.#configs.keyboardDollyRate = (keyboardDollyRate !== null && keyboardDollyRate !== undefined) ? keyboardDollyRate : 15.0;
    }

    /**
     * Gets how much the {@link Camera} dollys each second with touch input.
     *
     * Default is ````0.2````.
     *
     * @returns {Number} The current touch dolly rate.
     */
    get touchDollyRate(): number {
        return this.#configs.touchDollyRate;
    }

    /**
     * Sets how much the {@link Camera} dollys with touch input.
     *
     * Default is ````0.2````
     *
     * @param touchDollyRate The new touch dolly rate.
     */
    set touchDollyRate(touchDollyRate: number|undefined) {
        this.#configs.touchDollyRate = (touchDollyRate !== null && touchDollyRate !== undefined) ? touchDollyRate : 0.2;
    }

    /**
     * Gets how much the {@link Camera} dollys each second while the mouse wheel is spinning.
     *
     * Default is ````100.0````.
     *
     * @returns {Number} The current mouseWheel dolly rate.
     */
    get mouseWheelDollyRate(): number {
        return this.#configs.mouseWheelDollyRate;
    }

    /**
     * Sets how much the {@link Camera} dollys each second while the mouse wheel is spinning.
     *
     * Default is ````100.0````, to dolly the {@link Camera} ````10.0```` World-space units per second as we spin
     * the mouse wheel.
     *
     * @param mouseWheelDollyRate The new mouse wheel dolly rate.
     */
    set mouseWheelDollyRate(mouseWheelDollyRate: number|undefined) {
        this.#configs.mouseWheelDollyRate = (mouseWheelDollyRate !== null && mouseWheelDollyRate !== undefined) ? mouseWheelDollyRate : 100.0;
    }

    /**
     * Gets the dolly inertia factor.
     *
     * Default is ````0````.
     *
     * @returns {Number} The current dolly inertia factor.
     */
    get dollyInertia(): number {
        return this.#configs.dollyInertia;
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
     * @param dollyInertia New dolly inertia factor.
     */
    set dollyInertia(dollyInertia: number|undefined) {
        this.#configs.dollyInertia = (dollyInertia !== undefined && dollyInertia !== null) ? dollyInertia : 0;
    }

    /**
     * Gets the proximity to the closest object below which dolly speed decreases, and above which dolly speed increases.
     *
     * Default is ````35.0````.
     *
     * @returns {Number} The current dolly proximity threshold.
     */
    get dollyProximityThreshold(): number {
        return this.#configs.dollyProximityThreshold;
    }

    /**
     * Sets the proximity to the closest object below which dolly speed decreases, and above which dolly speed increases.
     *
     * Default is ````35.0````.
     *
     * @param dollyProximityThreshold New dolly proximity threshold.
     */
    set dollyProximityThreshold(dollyProximityThreshold: number|undefined) {
        this.#configs.dollyProximityThreshold = (dollyProximityThreshold !== undefined && dollyProximityThreshold !== null) ? dollyProximityThreshold : 35.0;
    }

    /**
     * Gets the minimum dolly speed.
     *
     * Default is ````0.04````.
     *
     * @returns {Number} The current minimum dolly speed.
     */
    get dollyMinSpeed(): number {
        return this.#configs.dollyMinSpeed;
    }

    /**
     * Sets the minimum dolly speed.
     *
     * Default is ````0.04````.
     *
     * @param dollyMinSpeed New dolly minimum speed.
     */
    set dollyMinSpeed(dollyMinSpeed: number|undefined) {
        this.#configs.dollyMinSpeed = (dollyMinSpeed !== undefined && dollyMinSpeed !== null) ? dollyMinSpeed : 0.04;
    }

    /**
     * Gets the pan inertia factor.
     *
     * Default is ````0.5````.
     *
     * @returns {Number} The current pan inertia factor.
     */
    get panInertia(): number {
        return this.#configs.panInertia;
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
     * @param panInertia New pan inertia factor.
     */
    set panInertia(panInertia: number|undefined) {
        this.#configs.panInertia = (panInertia !== undefined && panInertia !== null) ? panInertia : 0.5;
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
    get keyboardLayout(): string {
        return this.#configs.keyboardLayout;
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
     * @param value Selects the keyboard layout.
     */
    set keyboardLayout(value: string|undefined) {
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
     * Gets whether smart default pivoting is enabled.
     *
     * When ````true````, we'll pivot by default about the 3D position of the mouse/touch pointer on an
     * imaginary sphere that's centered at {@link Camera.eye} and sized to the {@link Scene} boundary.
     *
     * When ````false````, we'll pivot by default about {@link Camera.look}.
     *
     * Default is ````false````.
     *
     * @returns {Boolean} Returns ````true```` when pivoting by default about the selected point on the virtual sphere, or ````false```` when pivoting by default about {@link Camera.look}.
     */
    get smartPivot(): boolean {
        return this.#configs.smartPivot;
    }

    /**
     * Sets whether smart default pivoting is enabled.
     *
     * When ````true````, we'll pivot by default about the 3D position of the mouse/touch pointer on an
     * imaginary sphere that's centered at {@link Camera.eye} and sized to the {@link Scene} boundary.
     *
     * When ````false````, we'll pivot by default about {@link Camera.look}.
     *
     * Default is ````false````.
     *
     * @param enabled Set ````true```` to pivot by default about the selected point on the virtual sphere, or ````false```` to pivot by default about {@link Camera.look}.
     */
    set smartPivot(enabled: boolean|undefined) {
        this.#configs.smartPivot = (enabled !== false);
    }

    /**
     * Returns true if any keys configured for the given action are down.
     * @param action
     * @param keyDownMap
     * @private
     */
    _isKeyDownForAction(action: number, keyDownMap: { [key: number]: boolean }) {
        const keys = this.#keyMap[action];
        if (!keys) {
            return false;
        }
        if (!keyDownMap) {
            keyDownMap = this.view.input.keyDown;
        }
        for (let i = 0, len = keys.length; i < len; i++) {
            const key = keys[i];
            if (keyDownMap[key]) {
                return true;
            }
        }
        return false;
    }

    #reset() {
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
     * Destroys this ````CameraControl````.
     * @private
     */
    destroy() {
        this.#destroyHandlers();
        this.#destroyControllers();
        this.#cameraUpdater.destroy();
        super.destroy();
    }

    #destroyHandlers() {
        for (let i = 0, len = this.#handlers.length; i < len; i++) {
            const handler = this.#handlers[i];
            if (handler.destroy) {
                handler.destroy();
            }
        }
    }

    #destroyControllers() {
        for (let key in this.#controllers) {
            // @ts-ignore
            const controller = this.#controllers[key];
            if (controller.destroy) {
                controller.destroy();
            }
        }
    }
}

export {
    CameraControl
};
