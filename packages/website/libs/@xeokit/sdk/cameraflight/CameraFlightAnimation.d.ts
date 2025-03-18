import { Component, EventEmitter } from "../core";
import { type FloatArrayParam } from "../math";
import { Camera, View } from "../viewer";
/**
 * Animates a {@link viewer!View | View's} {@link viewer!Camera | Camera} to look at specified objects, boundaries or locations.
 *
 * See {@link cameraflight | @xeokit/sdk/cameraflight} for usage.
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
     */
    readonly onStarted: EventEmitter<CameraFlightAnimation, null>;
    /**
     * Emits an event each time the animation stops.
     */
    readonly onStopped: EventEmitter<CameraFlightAnimation, null>;
    /**
     * Emits an event each time the animation stops.
     */
    readonly onCancelled: EventEmitter<CameraFlightAnimation, null>;
    /**
     * Creates a new CameraFlightAnimation
     *
     * @param cfg.view The {@link viewer!View | View} whose {@link viewer!Camera | Camera} we'll animate.
     * @param cfg.duration Animation duration in seconds when using {@link cameraflight!CameraFlightAnimation.flyTo | CameraFlightAnimation.flyTo}.
     */
    constructor(view: View, cfg?: {
        duration: number;
    });
    /**
     * Flies the {@link viewer!Camera | Camera}  to a target.
     *
     *  * When the target is a boundary, the {@link viewer!Camera | Camera}  will fly towards the target and stop when the target fills most of the canvas.
     *  * When the target is an explicit {@link viewer!Camera | Camera}  position, given as ````eye````, ````look```` and ````up````, then CameraFlightAnimation will interpolate the {@link viewer!Camera | Camera}  to that target and stop there.
     *
     * @param {Object|Component} [params=Scene] Either a parameters object or a {@link core!Component | Component} subtype that has
     * an AABB. Defaults to the {@link scene!Scene | Scene}, which causes the {@link viewer!Camera | Camera}  to fit the Scene in view.
     * @param [params.arc=0] Factor in range ````[0..1]```` indicating how much the {@link viewer!Camera.eye | Camera.eye} position
     * will swing away from its {@link viewer!Camera.look | Camera.look} position as it flies to the target.
     * @param {Number|String|Component} [params.component] ID or instance of a component to fly to. Defaults to the entire {@link scene!Scene | Scene}.
     * @param [params.aabb] World-space axis-aligned bounding box (AABB) target to fly to.
     * @param [params.eye] Position to fly the eye position to.
     * @param [params.look] Position to fly the look position to.
     * @param [params.up] Position to fly the up vector to.
     * @param [params.projection] Projection type to transition into as we fly. Can be any of the values of {@link viewer!Camera.projectionType | Camera.projectionType | Camera.projectionType}.
     * @param [params.fit=true] Whether to fit the target to the view volume. Overrides {@link CameraFlightAnimation.fit | CameraFlightAnimation.fit}.
     * @param [params.fitFOV] How much of field-of-view, in degrees, that a target {@link viewer!ViewObject | ViewObject} or its AABB should
     * fill the canvas on arrival. Overrides {@link CameraFlightAnimation.fitFOV | CameraFlightAnimation.fitFOV}.
     * @param [params.duration] Flight duration in seconds.  Overrides {@link CameraFlightAnimation.duration | CameraFlightAnimation.duration}.
     * @param [params.orthoScale] Animate the Camera's orthographic scale to this target value. See {@link viewer!OrthoProjection.scale | OrthoProjection.scale}.
     * @param {Function} [callback] Callback fired on arrival.
     */
    flyTo(params?: {
        projection?: number;
        orthoScale?: number;
        aabb?: FloatArrayParam;
        length?: number;
        eye?: FloatArrayParam;
        look?: FloatArrayParam;
        up?: FloatArrayParam;
        poi?: FloatArrayParam;
        fitFOV?: number;
        duration?: number;
    }, callback?: (arg0: any) => void): void;
    /**
     * Jumps the {@link viewer!Camera | Camera}  to the given target.
     *
     * * When the target is a boundary, this CameraFlightAnimation will position the {@link viewer!Camera | Camera}  at where the target fills most of the canvas.
     * * When the target is an explicit {@link viewer!Camera | Camera}  position, given as ````eye````, ````look```` and ````up```` vectors, then this CameraFlightAnimation will jump the {@link viewer!Camera | Camera}  to that target.
     *
     * @param {*|Component} params  Either a parameters object or a {@link core!Component | Component} subtype that has a World-space AABB.
     * @param [params.arc=0]  Factor in range [0..1] indicating how much the {@link viewer!Camera.eye | Camera.eye} will swing away from its {@link viewer!Camera.look | Camera.look} as it flies to the target.
     * @param {Number|String|Component} [params.component] ID or instance of a component to fly to.
     * @param [params.aabb]  World-space axis-aligned bounding box (AABB) target to fly to.
     * @param [params.eye] Position to fly the eye position to.
     * @param [params.look]  Position to fly the look position to.
     * @param [params.up] Position to fly the up vector to.
     * @param [params.projection] Projection type to transition into. Can be any of the values of {@link viewer!Camera.projectionType | Camera.projectionType}.
     * @param [params.fitFOV] How much of field-of-view, in degrees, that a target {@link viewer!Viewer | Viewer} or its AABB should fill the canvas on arrival. Overrides {@link CameraFlightAnimation.fitFOV}.
     * @param [params.fit] Whether to fit the target to the view volume. Overrides {@link cameraFlightAnimation.fit | CameraFlightAnimation.fit}.
     */
    jumpTo(params: any): void;
    /**
     * Stops an earlier {@link CameraFlightAnimation.flyTo | CameraFlightAnimation.flyTo}, fires arrival callback, then "stopped" event.
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
     * When flying to a {@link scene!SceneModel | SceneModel}, {@link viewer!ViewObject | ViewObject} or boundary, indicates if the CameraFlightAnimation always adjusts
     * the distance of {@link viewer!Camera.eye | Camera.eye} from {@link viewer!Camera.look | Camera.look} to ensure that the target always fits in view.
     *
     * When false, the eye will remain fixed at its current distance from the look position.
     *
     * Default value is ````true````.
     */
    set fit(value: boolean);
    /**
     * When flying to a {@link scene!SceneModel | SceneModel}, {@link viewer!ViewObject | ViewObject} or boundary, indicates if the CameraFlightAnimation always adjusts
     * the distance of {@link viewer!Camera.eye | Camera.eye} from {@link viewer!Camera.look | Camera.look} to ensure that the target always fits in view.
     *
     * When false, the eye will remain fixed at its current distance from the look position.
     *
     * Default value is ````true````.
     */
    get fit(): boolean;
    /**
     * Sets how much of the perspective field-of-view, in degrees, that a target {@link viewer!ViewObject | ViewObject} should
     * fill the canvas when calling {@link CameraFlightAnimation.flyTo | CameraFlightAnimation.flyTo} or {@link CameraFlightAnimation.jumpTo | CameraFlightAnimation.jumpTo}.
     *
     * Default value is ````45````.
     */
    set fitFOV(value: number);
    /**
     * Gets how much of the perspective field-of-view, in degrees, that a target {@link viewer!ViewObject | ViewObject} should
     * fill the canvas when calling {@link CameraFlightAnimation.flyTo | CameraFlightAnimation.flyTo} or {@link CameraFlightAnimation.jumpTo | CameraFlightAnimation.jumpTo}.
     *
     * Default value is ````45````.
     */
    get fitFOV(): number;
    /**
     * Indicates if this CameraFlightAnimation will orient the {@link viewer!Camera | Camera}
     * in the direction that it is flying.
     *
     * Default value is ````false````.
     */
    set trail(value: boolean);
    /**
     * Indicates if this CameraFlightAnimation will orient the {@link viewer!Camera | Camera}
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
//# sourceMappingURL=CameraFlightAnimation.d.ts.map