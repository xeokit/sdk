import { Component } from '../../Component';
import { EventEmitter } from "./../../EventEmitter";
import * as math from "../../math/index";
import type { View } from "../View";
import type { Canvas } from "../Canvas";
import type { Camera } from "../camera/index";
import type { PickResult } from "../PickResult";
declare class HoverEvent {
}
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
export declare class CameraControl extends Component {
    #private;
    /**
     * Identifies the *leftwards panning* action, in which the {@link Camera} moves leftwards along its local axis.
     */
    static readonly PAN_LEFT: number;
    /**
     * Identifies the *rightwards panning* action, in which the {@link Camera} moves rightwards along its local axis.
     */
    static readonly PAN_RIGHT: number;
    /**
     * Identifies the *upwards panning* action, in which the {@link Camera} moves upwards along its local vertical axis.
     */
    static readonly PAN_UP: number;
    /**
     * Identifies the *downwards panning* action, in which the {@link Camera} moves downwards along its local vertical axis.
     */
    static readonly PAN_DOWN: number;
    /**
     * Identifies the *forwards panning* action, in which the {@link Camera} advances forwards along its current view direction.
     */
    static readonly PAN_FORWARDS: number;
    /**
     * Identifies the *backwards panning* action, in which the {@link Camera} retreats backwards along its current view direction.
     */
    static readonly PAN_BACKWARDS: number;
    /**
     * Identifies the *positive-rotation-about-X-axis* action.
     */
    static readonly ROTATE_X_POS: number;
    /**
     * Identifies the *negative-rotation-about-X-axis* action.
     */
    static readonly ROTATE_X_NEG: number;
    /**
     * Identifies the *positive-rotation-about-Y-axis* action.
     */
    static readonly ROTATE_Y_POS: number;
    /**
     * Identifies the *negative-rotation-about-Y-axis* action.
     */
    static readonly ROTATE_Y_NEG: number;
    /**
     * Identifies the *dolly forwards* action.
     */
    static readonly DOLLY_FORWARDS: number;
    /**
     * Identifies the *dolly backwards* action.
     */
    static readonly DOLLY_BACKWARDS: number;
    /**
     * Identifies the *axis-view-right* action.
     */
    static readonly AXIS_VIEW_RIGHT: number;
    /**
     * Identifies the *axis-view-back* action.
     */
    static readonly AXIS_VIEW_BACK: number;
    /**
     * Identifies the *axis-view-left* action.
     */
    static readonly AXIS_VIEW_LEFT: number;
    /**
     * Identifies the *axis-view-front* action.
     */
    static readonly AXIS_VIEW_FRONT: number;
    /**
     * Identifies the *axis-view-top* action.
     */
    static readonly AXIS_VIEW_TOP: number;
    /**
     * Identifies the *axis-view-bottom* action.
     */
    static readonly AXIS_VIEW_BOTTOM: number;
    /**
     * The View that owns this CameraControl.
     */
    readonly view: View;
    /**
     * The Canvas where this CameraContol listens for input.
     */
    readonly canvas: Canvas;
    /**
     * The Camera this CameraControl controls.
     */
    readonly camera: Camera;
    /**
     * Event fired when we right-click.
     *
     * @event
     */
    readonly onRightClick: EventEmitter<CameraControl, any>;
    /**
     * Event fired when the pointer moves while over a {@link ViewObject}.
     *
     * @event
     */
    readonly onHover: EventEmitter<CameraControl, HoverEvent>;
    /**
     * Event fired when the pointer moves while over a {@link ViewObject}.
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
     * Event fired when the pointer moves onto a {@link ViewObject}.
     *
     * @event
     */
    readonly onHoverEnter: EventEmitter<CameraControl, HoverEvent>;
    /**
     * Event fired when the pointer moves off a {@link ViewObject}.
     *
     * @event
     */
    readonly onHoverOut: EventEmitter<CameraControl, HoverEvent>;
    /**
     * Event fired when a {@link ViewObject} is picked.
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
        doublePickFlyTo?: boolean;
        keyboardEnabled?: boolean;
    });
    /**
     * Gets custom mappings of keys to {@link CameraControl} actions.
     *
     * @returns Current key mappings.
     */
    get keyMap(): {
        [key: number]: number;
    };
    /**
     * Sets custom mappings of keys to ````CameraControl```` actions.
     *
     * See class docs for usage.
     *
     * @param value Either a set of new key mappings, or a string to select a keyboard layout,
     * which causes ````CameraControl```` to use the default key mappings for that layout.
     */
    set keyMap(value: {
        [key: number]: number;
    } | string | undefined);
    /**
     * Sets the HTMl element to represent the pivot point when {@link CameraControl.followPointer} is true.
     *
     * See class comments for an example.
     *
     * @param  element HTML element representing the pivot point.
     */
    set pivotElement(element: HTMLElement);
    /**
     * Gets if this ````CameraControl```` is active or not.
     *
     * When inactive, the ````CameraControl```` will not react to input.
     *
     * Default is ````true````.
     *
     * @returns ````true```` if this ````CameraControl```` is active.
     */
    get active(): boolean;
    /**
     *  Sets if this ````CameraControl```` is active or not.
     *
     * When inactive, the ````CameraControl```` will not react to input.
     *
     * Default is ````true````.
     *
     * @param value Set ````true```` to activate this ````CameraControl````.
     */
    set active(value: boolean | undefined);
    /**
     * Gets the current navigation mode.
     *
     * @returns {String} The navigation mode: "orbit", "firstPerson" or "planView".
     */
    get navMode(): string;
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
    set navMode(navMode: string | undefined);
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
    get pointerEnabled(): boolean;
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
    set pointerEnabled(value: boolean);
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
    get followPointer(): boolean;
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
    set followPointer(value: boolean | undefined);
    /**
     * Gets the current World-space 3D pivot position.
     *
     * Only applies when {@link CameraControl.followPointer} is ````true````.
     *
     * @return {Number[]} worldPos The current World-space 3D pivot position.
     */
    get pivotPos(): math.FloatArrayParam;
    /**
     * Sets the current World-space 3D target position.
     *
     * Only applies when {@link CameraControl.followPointer} is ````true````.
     *
     * @param worldPos The new World-space 3D target position.
     */
    set pivotPos(worldPos: math.FloatArrayParam);
    /**
     * @deprecated
     * @returns {Boolean} Returns ````true```` if dolly-to-pointer behaviour is enabled.
     */
    get dollyToPointer(): boolean;
    /**
     * @deprecated
     * @param value Set ````true```` to enable dolly-to-pointer behaviour.
     */
    set dollyToPointer(value: boolean);
    /**
     * @deprecated
     * @returns {Boolean} Returns ````true```` if dolly-to-pointer behaviour is enabled.
     */
    get panToPointer(): boolean;
    /**
     * @deprecated
     * @param value Set ````true```` to enable dolly-to-pointer behaviour.
     */
    set panToPointer(value: boolean);
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
    get planView(): boolean;
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
    set planView(value: boolean);
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
    get firstPerson(): boolean;
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
    set firstPerson(value: boolean);
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
    get constrainVertical(): boolean;
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
    set constrainVertical(value: boolean | undefined);
    /**
     * Gets whether double-picking an {@link Entity} causes the {@link Camera} to fly to its boundary.
     *
     * Default is ````false````.
     *
     * @returns {Boolean} Returns ````true```` when double-pick-fly-to mode is enabled.
     */
    get doublePickFlyTo(): boolean;
    /**
     * Sets whether double-picking an {@link Entity} causes the {@link Camera} to fly to its boundary.
     *
     * Default is ````false````.
     *
     * @param value Set ````true```` to enable double-pick-fly-to mode.
     */
    set doublePickFlyTo(value: boolean | undefined);
    /**
     * Gets whether right-clicking pans the {@link Camera}.
     *
     * Default is ````true````.
     *
     * @returns {Boolean} Returns ````false```` when pan on right-click is disabled.
     */
    get panRightClick(): boolean;
    /**
     * Sets whether either right-clicking (true) or middle-clicking (false) pans the {@link Camera}.
     *
     * Default is ````true````.
     *
     * @param value Set ````false```` to disable pan on right-click.
     */
    set panRightClick(value: boolean | undefined);
    /**
     * Gets the rotation inertia factor.
     *
     * Default is ````0.0````.
     *
     * Does not apply when {@link CameraControl.navMode} is ````"planView"````, which disallows rotation.
     *
     * @returns {Number} The inertia factor.
     */
    get rotationInertia(): number;
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
    set rotationInertia(rotationInertia: number | undefined);
    /**
     * Gets how fast the {@link Camera} pans on touch panning
     *
     * Default is ````1.0````.
     *
     * @returns {Number} The current touch pan rate.
     */
    get touchPanRate(): number;
    /**
     * Sets how fast the camera pans on touch panning
     *
     * @param touchPanRate The new touch pan rate.
     */
    set touchPanRate(touchPanRate: number | undefined);
    /**
     * Gets how much the {@link Camera} pans each second with keyboard input.
     *
     * Default is ````5.0````.
     *
     * @returns {Number} The current keyboard pan rate.
     */
    get keyboardPanRate(): number;
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
    set keyboardPanRate(keyboardPanRate: number | undefined);
    /**
     * Sets how many degrees per second the {@link Camera} rotates/orbits with keyboard input.
     *
     * Default is ````90.0````.
     *
     * @returns {Number} The current keyboard rotation rate.
     */
    get keyboardRotationRate(): number;
    /**
     * Sets how many degrees per second the {@link Camera} rotates/orbits with keyboard input.
     *
     * Default is ````90.0````, to rotate/orbit the Camera ````90.0```` degrees every second that
     * a rotation key is depressed. See the ````CameraControl```` class documentation for which keys control
     * rotation/orbit.
     *
     * @param keyboardRotationRate The new keyboard rotation rate.
     */
    set keyboardRotationRate(keyboardRotationRate: number | undefined);
    /**
     * Gets the current drag rotation rate.
     *
     * Default is ````360.0````.
     *
     * @returns {Number} The current drag rotation rate.
     */
    get dragRotationRate(): number;
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
    set dragRotationRate(dragRotationRate: number | undefined);
    /**
     * Gets how much the {@link Camera} dollys each second with keyboard input.
     *
     * Default is ````15.0````.
     *
     * @returns {Number} The current keyboard dolly rate.
     */
    get keyboardDollyRate(): number;
    /**
     * Sets how much the {@link Camera} dollys each second with keyboard input.
     *
     * Default is ````15.0````, to dolly the {@link Camera} ````15.0```` World-space units per second while we hold down
     * the ````+```` and ````-```` keys.
     *
     * @param keyboardDollyRate The new keyboard dolly rate.
     */
    set keyboardDollyRate(keyboardDollyRate: number | undefined);
    /**
     * Gets how much the {@link Camera} dollys each second with touch input.
     *
     * Default is ````0.2````.
     *
     * @returns {Number} The current touch dolly rate.
     */
    get touchDollyRate(): number;
    /**
     * Sets how much the {@link Camera} dollys with touch input.
     *
     * Default is ````0.2````
     *
     * @param touchDollyRate The new touch dolly rate.
     */
    set touchDollyRate(touchDollyRate: number | undefined);
    /**
     * Gets how much the {@link Camera} dollys each second while the mouse wheel is spinning.
     *
     * Default is ````100.0````.
     *
     * @returns {Number} The current mouseWheel dolly rate.
     */
    get mouseWheelDollyRate(): number;
    /**
     * Sets how much the {@link Camera} dollys each second while the mouse wheel is spinning.
     *
     * Default is ````100.0````, to dolly the {@link Camera} ````10.0```` World-space units per second as we spin
     * the mouse wheel.
     *
     * @param mouseWheelDollyRate The new mouse wheel dolly rate.
     */
    set mouseWheelDollyRate(mouseWheelDollyRate: number | undefined);
    /**
     * Gets the dolly inertia factor.
     *
     * Default is ````0````.
     *
     * @returns {Number} The current dolly inertia factor.
     */
    get dollyInertia(): number;
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
    set dollyInertia(dollyInertia: number | undefined);
    /**
     * Gets the proximity to the closest object below which dolly speed decreases, and above which dolly speed increases.
     *
     * Default is ````35.0````.
     *
     * @returns {Number} The current dolly proximity threshold.
     */
    get dollyProximityThreshold(): number;
    /**
     * Sets the proximity to the closest object below which dolly speed decreases, and above which dolly speed increases.
     *
     * Default is ````35.0````.
     *
     * @param dollyProximityThreshold New dolly proximity threshold.
     */
    set dollyProximityThreshold(dollyProximityThreshold: number | undefined);
    /**
     * Gets the minimum dolly speed.
     *
     * Default is ````0.04````.
     *
     * @returns {Number} The current minimum dolly speed.
     */
    get dollyMinSpeed(): number;
    /**
     * Sets the minimum dolly speed.
     *
     * Default is ````0.04````.
     *
     * @param dollyMinSpeed New dolly minimum speed.
     */
    set dollyMinSpeed(dollyMinSpeed: number | undefined);
    /**
     * Gets the pan inertia factor.
     *
     * Default is ````0.5````.
     *
     * @returns {Number} The current pan inertia factor.
     */
    get panInertia(): number;
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
    set panInertia(panInertia: number | undefined);
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
    get keyboardLayout(): string;
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
    set keyboardLayout(value: string | undefined);
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
    get smartPivot(): boolean;
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
    set smartPivot(enabled: boolean | undefined);
    /**
     * Gets whether keyboard input is enabled.
     */
    get keyboardEnabled(): boolean;
    /**
     * Sets whether keyboard input is enabled.
     */
    set keyboardEnabled(enabled: boolean | undefined);
    /**
     * Returns true if any keys configured for the given action are down.
     * @param action
     * @param keyDownMap
     * @private
     */
    _isKeyDownForAction(action: number, keyDownMap: {
        [key: number]: boolean;
    }): boolean;
    /**
     * Destroys this ````CameraControl````.
     * @private
     */
    destroy(): void;
}
export {};
