import type { View } from "./View";
import type { Camera } from "./Camera";
import { Component, EventEmitter } from "@xeokit/core";
import { FloatArrayParam } from "@xeokit/math";
/**
 * Animates its {@link View |View's} {@link @xeokit/viewer!Camera}  to look at specified objects, boundaries or locations.
 *
 * ## Summary
 *
 * * Belongs to a {@link @xeokit/viewer!View}, and is located at {@link View.cameraFlight}
 * * Controls the View's {@link @xeokit/viewer!Camera} , which is located at {@link View.camera}
 * * Navigates the Camera to look at a {@link ViewerObject} or boundary
 * * Navigates the Camera to an explicit position given as ````eye````, ````look```` and ````up```` vectors
 * * Jumps or flies the Camera
 * * Smoothly transitions between projections
 */
declare class CameraFlightAnimation extends Component {
    #private;
    /**
     * The View that owns this CameraFlightAnimation.
     */
    readonly view: View;
    /**
     * The Camera controlled by this CameraFlightAnimation.
     */
    readonly camera: Camera;
    easing: boolean;
    /**
     * Emits an event each time the animation starts.
     *
     * @event
     */
    readonly onStarted: EventEmitter<CameraFlightAnimation, null>;
    /**
     * Emits an event each time the animation stops.
     *
     * @event
     */
    readonly onStopped: EventEmitter<CameraFlightAnimation, null>;
    /**
     * Emits an event each time the animation stops.
     *
     * @event
     */
    readonly onCancelled: EventEmitter<CameraFlightAnimation, null>;
    /**
     @private
     */
    constructor(view: View, cfg?: {
        duration: number;
    });
    /**
     * Flies the {@link @xeokit/viewer!Camera}  to a target.
     *
     *  * When the target is a boundary, the {@link @xeokit/viewer!Camera}  will fly towards the target and stop when the target fills most of the canvas.
     *  * When the target is an explicit {@link @xeokit/viewer!Camera}  position, given as ````eye````, ````look```` and ````up````, then CameraFlightAnimation will interpolate the {@link @xeokit/viewer!Camera}  to that target and stop there.
     *
     * @param {Object|Component} [params=Scene] Either a parameters object or a {@link @xeokit/core!Component} subtype that has
     * an AABB. Defaults to the {@link Scene}, which causes the {@link @xeokit/viewer!Camera}  to fit the Scene in view.
     * @param [params.arc=0] Factor in range ````[0..1]```` indicating how much the {@link Camera.eye} position
     * will swing away from its {@link Camera.look} position as it flies to the target.
     * @param {Number|String|Component} [params.component] ID or instance of a component to fly to. Defaults to the entire {@link Scene}.
     * @param [params.aabb] World-space axis-aligned bounding box (AABB) target to fly to.
     * @param [params.eye] Position to fly the eye position to.
     * @param [params.look] Position to fly the look position to.
     * @param [params.up] Position to fly the up vector to.
     * @param [params.projection] Projection type to transition into as we fly. Can be any of the values of {@link Camera.projectionType}.
     * @param [params.fit=true] Whether to fit the target to the view volume. Overrides {@link CameraFlightAnimation.fit}.
     * @param [params.fitFOV] How much of field-of-view, in degrees, that a target {@link ViewerObject} or its AABB should
     * fill the canvas on arrival. Overrides {@link CameraFlightAnimation.fitFOV}.
     * @param [params.duration] Flight duration in seconds.  Overrides {@link CameraFlightAnimation.duration}.
     * @param [params.orthoScale] Animate the Camera's orthographic scale to this target value. See {@link Ortho.scale}.
     * @param {Function} [callback] Callback fired on arrival.
     * @param {Object} [scope] Optional scope for callback.
     */
    flyTo(params: {
        projection?: number | undefined;
        orthoScale?: number | undefined;
        aabb?: FloatArrayParam | undefined;
        length?: number | undefined;
        eye?: FloatArrayParam | undefined;
        look?: FloatArrayParam | undefined;
        up?: FloatArrayParam | undefined;
        poi?: FloatArrayParam | undefined;
        fitFOV?: number | undefined;
        duration?: number | undefined;
    } | undefined, callback: {
        (): void;
        call: (arg0: any) => void;
    }): void;
    /**
     * Jumps the {@link @xeokit/viewer!View}'s {@link @xeokit/viewer!Camera}  to the given target.
     *
     * * When the target is a boundary, this CameraFlightAnimation will position the {@link @xeokit/viewer!Camera}  at where the target fills most of the canvas.
     * * When the target is an explicit {@link @xeokit/viewer!Camera}  position, given as ````eye````, ````look```` and ````up```` vectors, then this CameraFlightAnimation will jump the {@link @xeokit/viewer!Camera}  to that target.
     *
     * @param {*|Component} params  Either a parameters object or a {@link @xeokit/core!Component} subtype that has a World-space AABB.
     * @param [params.arc=0]  Factor in range [0..1] indicating how much the {@link Camera.eye} will swing away from its {@link Camera.look} as it flies to the target.
     * @param {Number|String|Component} [params.component] ID or instance of a component to fly to.
     * @param [params.aabb]  World-space axis-aligned bounding box (AABB) target to fly to.
     * @param [params.eye] Position to fly the eye position to.
     * @param [params.look]  Position to fly the look position to.
     * @param [params.up] Position to fly the up vector to.
     * @param [params.projection] Projection type to transition into. Can be any of the values of {@link Camera.projectionType}.
     * @param [params.fitFOV] How much of field-of-view, in degrees, that a target {@link ViewerObject} or its AABB should fill the canvas on arrival. Overrides {@link CameraFlightAnimation.fitFOV}.
     * @param [params.fit] Whether to fit the target to the view volume. Overrides {@link CameraFlightAnimation.fit}.
     */
    jumpTo(params: any): void;
    /**
     * Stops an earlier {@link CameraFlightAnimation.flyTo}, fires arrival callback, then "stopped" event.
     */
    stop(): void;
    /**
     * Cancels a flight in progress, without calling the arrival callback.
     */
    cancel(): void;
    /**
     * Sets the flight duration in seconds.
     *
     * Stops any flight currently in progress.
     *
     * Default value is ````0.5````.
     */
    set duration(value: number);
    /**
     * Gets the flight duration in seconds.
     *
     * Default value is ````0.5````.
     */
    get duration(): number;
    /**
     * When flying to a {@link @xeokit/scene!SceneModel | SceneModel}, {@link ViewerObject} or boundary, indicates if the CameraFlightAnimation always adjusts
     * the distance of {@link Camera.eye} from {@link Camera.look} to ensure that the target always fits in view.
     *
     * When false, the eye will remain fixed at its current distance from the look position.
     *
     * Default value is ````true````.
     */
    set fit(value: boolean);
    /**
     * When flying to a {@link @xeokit/scene!SceneModel | SceneModel}, {@link ViewerObject} or boundary, indicates if the CameraFlightAnimation always adjusts
     * the distance of {@link Camera.eye} from {@link Camera.look} to ensure that the target always fits in view.
     *
     * When false, the eye will remain fixed at its current distance from the look position.
     *
     * Default value is ````true````.
     */
    get fit(): boolean;
    /**
     * Sets how much of the perspective field-of-view, in degrees, that a target {@link ViewerObject.aabb} should
     * fill the canvas when calling {@link CameraFlightAnimation.flyTo} or {@link CameraFlightAnimation.jumpTo}.
     *
     * Default value is ````45````.
     */
    set fitFOV(value: number);
    /**
     * Gets how much of the perspective field-of-view, in degrees, that a target {@link ViewerObject.aabb} should
     * fill the canvas when calling {@link CameraFlightAnimation.flyTo} or {@link CameraFlightAnimation.jumpTo}.
     *
     * Default value is ````45````.
     */
    get fitFOV(): number;
    /**
     * Indicates if this CameraFlightAnimation will orient the {@link @xeokit/viewer!Camera}
     * in the direction that it is flying.
     *
     * Default value is ````false````.
     */
    set trail(value: boolean);
    /**
     * Indicates if this CameraFlightAnimation will orient the {@link @xeokit/viewer!Camera}
     * in the direction that it is flying.
     *
     * Default value is ````false````.
     */
    get trail(): boolean;
    /**
     * @private
     */
    destroy(): void;
}
export { CameraFlightAnimation };
