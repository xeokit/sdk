import { PickResult, View } from "../viewer";
import { Component, EventEmitter } from "../core";
import { CameraControlParams } from "./CameraControlParams";
import { FloatArrayParam } from "../math";
/**
 *
 */
declare class HoverEvent {
}
/**
 * Mouse and touch controller for a {@link viewer!Viewer | Viewer's} {@link viewer!Camera | Camera}.
 *
 * See {@link cameracontrol | @xeokit/sdk/cameracontrol} for usage.
 */
export declare class CameraControl extends Component {
    #private;
    /**
     * Represents a leftward panning action.
     */
    static PAN_LEFT: number;
    /**
     * Represents a rightward panning action.
     */
    static PAN_RIGHT: number;
    /**
     * Represents an upward panning action.
     */
    static PAN_UP: number;
    /**
     * Represents a downward panning action.
     */
    static PAN_DOWN: number;
    /**
     * Represents a forward panning action.
     */
    static PAN_FORWARDS: number;
    /**
     * Represents a backward panning action.
     */
    static PAN_BACKWARDS: number;
    /**
     * Rotates the view clockwise around the X-axis.
     */
    static ROTATE_X_POS: number;
    /**
     * Rotates the view counterclockwise around the X-axis.
     */
    static ROTATE_X_NEG: number;
    /**
     * Rotates the view clockwise around the Y-axis.
     */
    static ROTATE_Y_POS: number;
    /**
     * Rotates the view counterclockwise around the Y-axis.
     */
    static ROTATE_Y_NEG: number;
    /**
     * Moves the camera forward (dolly in).
     */
    static DOLLY_FORWARDS: number;
    /**
     * Moves the camera backward (dolly out).
     */
    static DOLLY_BACKWARDS: number;
    /**
     * Positions the {@link viewer!Camera | Camera} to view the right side
     * of the entire extents of the {@link viewer!View | View}.
     */
    static AXIS_VIEW_RIGHT: number;
    /**
     * Positions the {@link viewer!Camera | Camera} to view the back side
     * of the entire extents of the {@link viewer!View | View}.
     */
    static AXIS_VIEW_BACK: number;
    /**
     * Positions the {@link viewer!Camera | Camera} to view the left side
     * of the entire extents of the {@link viewer!View | View}.
     */
    static AXIS_VIEW_LEFT: number;
    /**
     * Positions the {@link viewer!Camera | Camera} to view the front side
     * of the entire extents of the {@link viewer!View | View}.
     */
    static AXIS_VIEW_FRONT: number;
    /**
     * Positions the {@link viewer!Camera | Camera} to look downward
     * at the entire extents of the {@link viewer!View | View}.
     */
    static AXIS_VIEW_TOP: number;
    /**
     * Positions the {@link viewer!Camera | Camera} to look upward from below
     * at the entire extents of the {@link viewer!View | View}.
     */
    static AXIS_VIEW_BOTTOM: number;
    view: View;
    /**
     * Event fired when we right-click.
     *
     * @event
     */
    readonly onRightClick: EventEmitter<CameraControl, any>;
    /**
     * Event fired when the pointer moves while over a {@link viewer!ViewObject}.
     *
     * @event
     */
    readonly onHover: EventEmitter<CameraControl, HoverEvent>;
    /**
     * Event fired when the pointer moves while over a {@link viewer!ViewObject}.
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
     * Event fired when the pointer moves onto a {@link viewer!ViewObject}.
     *
     * @event
     */
    readonly onHoverEnter: EventEmitter<CameraControl, HoverEvent>;
    /**
     * Event fired when the pointer moves off a {@link viewer!ViewObject}.
     *
     * @event
     */
    readonly onHoverOut: EventEmitter<CameraControl, HoverEvent>;
    /**
     * Event fired when a {@link viewer!ViewObject} is picked.
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
    /**
     * @private
     *
     */
    constructor(view: View, cfg?: CameraControlParams);
    /**
     * Sets custom mappings of keys to ````CameraControl```` actions.
     *
     * See class docs for usage.
     *
     * @param {{Number:Number}|String} value Either a set of new key mappings, or a string to select a keyboard layout,
     * which causes ````CameraControl```` to use the default key mappings for that layout.
     */
    set keyMap(value: {
        Number: Number;
    } | number);
    /**
     * Gets custom mappings of keys to {@link CameraControl} actions.
     */
    get keyMap(): {
        Number: Number;
    } | number;
    /**
     * Returns true if any keys configured for the given action are down.
     * @param action
     * @param keyDownMap
     * @private
     */
    _isKeyDownForAction(action: number, keyDownMap: any): boolean;
    /**
     * Sets the HTMl element to represent the pivot point when {@link CameraControl#followPointer} is true.
     *
     * See class comments for an example.
     */
    set pivotElement(element: HTMLElement);
    /**
     *  Sets if this ````CameraControl```` is active or not.
     *
     * When inactive, the ````CameraControl```` will not react to input.
     *
     * Default is ````true````.
     */
    set active(value: boolean);
    /**
     * Gets if this ````CameraControl```` is active or not.
     *
     * When inactive, the ````CameraControl```` will not react to input.
     *
     * Default is ````true````.
     *
     * @returns Returns ````true```` if this ````CameraControl```` is active.
     */
    get active(): boolean;
    /**
     * Sets whether the pointer snap to vertex.
     */
    set snapToVertex(snapToVertex: boolean);
    /**
     * Gets whether the pointer snap to vertex.
     */
    get snapToVertex(): boolean;
    /**
     * Sets whether the pointer snap to edge.
     */
    set snapToEdge(snapToEdge: boolean);
    /**
     * Gets whether the pointer snap to edge.
     */
    get snapToEdge(): boolean;
    /**
     * Sets the current snap radius for "hoverSnapOrSurface" events, to specify whether the radius
     * within which the pointer snaps to the nearest vertex or the nearest edge.
     *
     * Default value is 30 pixels.
     */
    set snapRadius(snapRadius: number);
    /**
     * Gets the current snap radius.
     */
    get snapRadius(): number;
    /**
     * If `true`, the keyboard shortcuts are enabled ONLY if the mouse is over the canvas.
     */
    set keyboardEnabledOnlyIfMouseover(value: boolean);
    /**
     * Gets whether the keyboard shortcuts are enabled ONLY if the mouse is over the canvas or ALWAYS.
     */
    get keyboardEnabledOnlyIfMouseover(): boolean;
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
    get navMode(): number;
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
    set navMode(navMode: number | undefined);
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
    set pointerEnabled(value: boolean);
    _reset(): void;
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
    get pointerEnabled(): boolean;
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
    set followPointer(value: boolean);
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
    get followPointer(): boolean;
    /**
     * Sets the current World-space 3D target position.
     *
     * Only applies when {@link CameraControl#followPointer} is ````true````.
     *
     * @param worldPos The new World-space 3D target position.
     */
    set pivotPos(worldPos: FloatArrayParam);
    /**
     * Gets the current World-space 3D pivot position.
     *
     * Only applies when {@link CameraControl#followPointer} is ````true````.
     *
     * @return  worldPos The current World-space 3D pivot position.
     */
    get pivotPos(): FloatArrayParam;
    /**
     * Sets whether to vertically constrain the {@link viewer!Camera} position for first-person navigation.
     *
     * When set ````true````, this constrains {@link viewer!Camera#eye} to its current vertical position.
     *
     * Only applies when {@link CameraControl#navMode} is ````"firstPerson"````.
     *
     * Default is ````false````.
     *
     * @param value Set ````true```` to vertically constrain the Camera.
     */
    set constrainVertical(value: boolean);
    /**
     * Gets whether to vertically constrain the {@link viewer!Camera} position for first-person navigation.
     *
     * When set ````true````, this constrains {@link viewer!Camera#eye} to its current vertical position.
     *
     * Only applies when {@link CameraControl#navMode} is ````"firstPerson"````.
     *
     * Default is ````false````.
     *
     * @returns ````true```` when Camera is vertically constrained.
     */
    get constrainVertical(): boolean;
    /**
     * Sets whether double-picking an object causes the {@link viewer!Camera} to fly to its boundary.
     *
     * Default is ````false````.
     *
     * @param value Set ````true```` to enable double-pick-fly-to mode.
     */
    set doublePickFlyTo(value: boolean);
    /**
     * Gets whether double-picking an object causes the {@link viewer!Camera} to fly to its boundary.
     *
     * Default is ````false````.
     *
     * @returns Returns ````true```` when double-pick-fly-to mode is enabled.
     */
    get doublePickFlyTo(): boolean;
    /**
     * Sets whether either right-clicking (true) or middle-clicking (false) pans the {@link viewer!Camera}.
     *
     * Default is ````true````.
     *
     * @param value Set ````false```` to disable pan on right-click.
     */
    set panRightClick(value: boolean);
    /**
     * Gets whether right-clicking pans the {@link viewer!Camera}.
     *
     * Default is ````true````.
     *
     * @returns Returns ````false```` when pan on right-click is disabled.
     */
    get panRightClick(): boolean;
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
     * Does not apply when {@link CameraControl#navMode} is ````"planView"````, which disallows rotation.
     *
     * @param rotationInertia New inertial factor.
     */
    set rotationInertia(rotationInertia: number);
    /**
     * Gets the rotation inertia factor.
     *
     * Default is ````0.0````.
     *
     * Does not apply when {@link CameraControl#navMode} is ````"planView"````, which disallows rotation.
     *
     * @returns The inertia factor.
     */
    get rotationInertia(): number;
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
    set keyboardPanRate(keyboardPanRate: number);
    /**
     * Sets how fast the camera pans on touch panning
     *
     * @param touchPanRate The new touch pan rate.
     */
    set touchPanRate(touchPanRate: number);
    /**
     * Gets how fast the {@link viewer!Camera} pans on touch panning
     *
     * Default is ````1.0````.
     *
     * @returns The current touch pan rate.
     */
    get touchPanRate(): number;
    /**
     * Gets how much the {@link viewer!Camera} pans each second with keyboard input.
     *
     * Default is ````5.0````.
     *
     * @returns The current keyboard pan rate.
     */
    get keyboardPanRate(): number;
    /**
     * Sets how many degrees per second the {@link viewer!Camera} rotates/orbits with keyboard input.
     *
     * Default is ````90.0````, to rotate/orbit the Camera ````90.0```` degrees every second that
     * a rotation key is depressed. See the ````CameraControl```` class documentation for which keys control
     * rotation/orbit.
     *
     * @param keyboardRotationRate The new keyboard rotation rate.
     */
    set keyboardRotationRate(keyboardRotationRate: number);
    /**
     * Sets how many degrees per second the {@link viewer!Camera} rotates/orbits with keyboard input.
     *
     * Default is ````90.0````.
     *
     * @returns The current keyboard rotation rate.
     */
    get keyboardRotationRate(): number;
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
    set dragRotationRate(dragRotationRate: number);
    /**
     * Gets the current drag rotation rate.
     *
     * Default is ````360.0````.
     *
     * @returns The current drag rotation rate.
     */
    get dragRotationRate(): number;
    /**
     * Sets how much the {@link viewer!Camera} dollys each second with keyboard input.
     *
     * Default is ````15.0````, to dolly the {@link viewer!Camera} ````15.0```` World-space units per second while we hold down
     * the ````+```` and ````-```` keys.
     *
     * @param keyboardDollyRate The new keyboard dolly rate.
     */
    set keyboardDollyRate(keyboardDollyRate: number);
    /**
     * Gets how much the {@link viewer!Camera} dollys each second with keyboard input.
     *
     * Default is ````15.0````.
     *
     * @returns The current keyboard dolly rate.
     */
    get keyboardDollyRate(): number;
    /**
     * Sets how much the {@link viewer!Camera} dollys with touch input.
     *
     * Default is ````0.2````
     *
     * @param touchDollyRate The new touch dolly rate.
     */
    set touchDollyRate(touchDollyRate: number);
    /**
     * Gets how much the {@link viewer!Camera} dollys each second with touch input.
     *
     * Default is ````0.2````.
     *
     * @returns The current touch dolly rate.
     */
    get touchDollyRate(): number;
    /**
     * Sets how much the {@link viewer!Camera} dollys each second while the mouse wheel is spinning.
     *
     * Default is ````100.0````, to dolly the {@link viewer!Camera} ````10.0```` World-space units per second as we spin
     * the mouse wheel.
     *
     * @param mouseWheelDollyRate The new mouse wheel dolly rate.
     */
    set mouseWheelDollyRate(mouseWheelDollyRate: number);
    /**
     * Gets how much the {@link viewer!Camera} dollys each second while the mouse wheel is spinning.
     *
     * Default is ````100.0````.
     *
     * @returns The current mouseWheel dolly rate.
     */
    get mouseWheelDollyRate(): number;
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
    set dollyInertia(dollyInertia: number);
    /**
     * Gets the dolly inertia factor.
     *
     * Default is ````0````.
     *
     * @returns The current dolly inertia factor.
     */
    get dollyInertia(): number;
    /**
     * Sets the proximity to the closest object below which dolly speed decreases, and above which dolly speed increases.
     *
     * Default is ````35.0````.
     *
     * @param dollyProximityThreshold New dolly proximity threshold.
     */
    set dollyProximityThreshold(dollyProximityThreshold: number);
    /**
     * Gets the proximity to the closest object below which dolly speed decreases, and above which dolly speed increases.
     *
     * Default is ````35.0````.
     *
     * @returns The current dolly proximity threshold.
     */
    get dollyProximityThreshold(): number;
    /**
     * Sets the minimum dolly speed.
     *
     * Default is ````0.04````.
     *
     * @param dollyMinSpeed New dolly minimum speed.
     */
    set dollyMinSpeed(dollyMinSpeed: number);
    /**
     * Gets the minimum dolly speed.
     *
     * Default is ````0.04````.
     *
     * @returns The current minimum dolly speed.
     */
    get dollyMinSpeed(): number;
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
    set panInertia(panInertia: number);
    /**
     * Gets the pan inertia factor.
     *
     * Default is ````0.5````.
     *
     * @returns The current pan inertia factor.
     */
    get panInertia(): number;
    /**
     * Sets a sphere as the representation of the pivot position.
     *
     * @param [cfg] Sphere configuration.
     * @param [cfg.size=1] Optional size factor of the sphere. Defaults to 1.
     * @param [cfg.material=PhongMaterial] Optional size factor of the sphere. Defaults to a red opaque material.
     */
    enablePivotSphere(cfg?: {}): void;
    /**
     * Remove the sphere as the representation of the pivot position.
     */
    disablePivotSphere(): void;
    /**
     * Sets whether smart default pivoting is enabled.
     *
     * When ````true````, we'll pivot by default about the 3D position of the mouse/touch pointer on an
     * imaginary sphere that's centered at {@link viewer!Camera#eye} and sized to the {@link scene!Scene} boundary.
     *
     * When ````false````, we'll pivot by default about {@link viewer!Camera#look}.
     *
     * Default is ````false````.
     *
     * @param enabled Set ````true```` to pivot by default about the selected point on the virtual sphere, or ````false```` to pivot by default about {@link viewer!Camera#look}.
     */
    set smartPivot(enabled: boolean);
    /**
     * Gets whether smart default pivoting is enabled.
     *
     * When ````true````, we'll pivot by default about the 3D position of the mouse/touch pointer on an
     * imaginary sphere that's centered at {@link viewer!Camera#eye} and sized to the {@link scene!Scene} boundary.
     *
     * When ````false````, we'll pivot by default about {@link viewer!Camera#look}.
     *
     * Default is ````false````.
     *
     * @returns Returns ````true```` when pivoting by default about the selected point on the virtual sphere, or ````false```` when pivoting by default about {@link viewer!Camera#look}.
     */
    get smartPivot(): boolean;
    /**
     * Sets the double click time frame length in milliseconds.
     *
     * If two mouse click events occur within this time frame, it is considered a double click.
     *
     * Default is ````250````
     *
     * @param value New double click time frame.
     */
    set doubleClickTimeFrame(value: number);
    /**
     * Gets the double click time frame length in milliseconds.
     *
     * Default is ````250````
     *
     * @returns Current double click time frame.
     */
    get doubleClickTimeFrame(): number;
    /**
     * Destroys this ````CameraControl````.
     * @private
     */
    destroy(): void;
    _destroyHandlers(): void;
    _destroyControllers(): void;
}
export {};
//# sourceMappingURL=CameraControl.d.ts.map