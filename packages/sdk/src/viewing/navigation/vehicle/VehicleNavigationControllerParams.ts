import type {SceneRaycaster} from "../../../spatial/collision";
import type {ModelNavigationController} from "../model";

/**
 * Configures {@link VehicleNavigationController}.
 */
export interface VehicleNavigationControllerParams {
    /**
     * Whether the controller starts active.
     *
     * Default is ``true``.
     */
    active?: boolean;

    /**
     * Optional raycaster used for drive-surface following and obstacle tests.
     *
     * When omitted, the controller creates a {@link SceneRaycaster} for the
     * View's Scene.
     */
    raycaster?: SceneRaycaster;

    /**
     * Optional standard ModelNavigationController to suspend while vehicle navigation is active.
     *
     * Use this when enabling vehicle navigation inside Viewer/Studio applications
     * that already have the default camera controller installed.
     */
    suspendModelNavigationController?: ModelNavigationController;

    /**
     * Camera height above the driven surface, in world-space units.
     *
     * Default is ``1.45``.
     */
    cameraHeight?: number;

    /**
     * Approximate vehicle/body radius used for ground and flight obstacle tests.
     *
     * Default is ``0.45``.
     */
    bodyRadius?: number;

    /**
     * Maximum forward speed, in world-space units per second.
     *
     * Default is ``22``.
     */
    maxForwardSpeed?: number;

    /**
     * Maximum reverse speed, in world-space units per second.
     *
     * Default is ``5``.
     */
    maxReverseSpeed?: number;

    /**
     * Forward acceleration, in world-space units per second squared.
     *
     * Default is ``9``.
     */
    acceleration?: number;

    /**
     * Braking deceleration when pressing reverse while moving forward.
     *
     * Default is ``18``.
     */
    brakeDeceleration?: number;

    /**
     * Passive deceleration when no throttle or brake key is pressed.
     *
     * Default is ``5``.
     */
    coastDeceleration?: number;

    /**
     * Base steering yaw rate, in degrees per second.
     *
     * Ground steering is scaled by speed: low speeds turn above this base rate
     * for tight carving, while high speeds turn below it for stability. Flight
     * steering keeps speed-proportional aircraft-like behavior.
     *
     * Default is ``95``.
     */
    turnRateDegreesPerSecond?: number;

    /**
     * Deprecated compatibility option. Hover cursor steering is no longer used;
     * vehicle steering is driven by keyboard ramping and captured mouse drag.
     *
     * @deprecated This option is ignored.
     */
    cursorTurnDeadZone?: number;

    /**
     * Deprecated compatibility option. Hover cursor steering is no longer used;
     * vehicle steering is driven by keyboard ramping and captured mouse drag.
     *
     * @deprecated This option is ignored.
     */
    cursorTurnResponse?: number;

    /**
     * Initial fraction of the steering rate applied when a turn key is first
     * pressed. The rate ramps toward full steering while the key is held.
     *
     * Default is ``0.28``.
     */
    keySteerInitialScale?: number;

    /**
     * Time, in seconds, for held turn keys to ramp from the initial steering
     * scale to the full steering rate.
     *
     * Default is ``1.45``.
     */
    keySteerRampSeconds?: number;

    /**
     * Maximum camera roll into a turn, in degrees.
     *
     * Ground roll is scaled by speed, so slow steering stays upright and faster
     * carving banks more visibly.
     *
     * Default is ``18``.
     */
    leanDegrees?: number;

    /**
     * Camera-roll smoothing factor, in response units per second.
     *
     * Ground roll response is also scaled by speed, so banking snaps in more at
     * speed than while creeping.
     *
     * Default is ``8``.
     */
    leanSmoothing?: number;

    /**
     * Fraction of the current drive-surface incline/decline pitch applied to
     * the camera while ground driving.
     *
     * Values below ``1`` keep the rider partly upright instead of exactly
     * matching the surface.
     *
     * Default is ``0.42``.
     */
    slopePitchFactor?: number;

    /**
     * Response factor used when easing camera pitch toward the current
     * drive-surface incline/decline.
     *
     * Default is ``5.5``.
     */
    slopePitchSmoothing?: number;

    /**
     * Maximum camera pitch contributed by drive-surface incline/decline, in
     * degrees.
     *
     * Default is ``10``.
     */
    maxSlopePitchDegrees?: number;

    /**
     * Maximum cursor-controlled up/down look pitch, in degrees.
     *
     * Default is ``18``.
     */
    maxPitchDegrees?: number;

    /**
     * Maximum cursor-controlled up/down look pitch while flying, in degrees.
     *
     * Default is ``65``.
     */
    maxFlightPitchDegrees?: number;

    /**
     * Keyboard pitch rate while flying, in degrees per second.
     *
     * Default is ``58``.
     */
    flightPitchRateDegreesPerSecond?: number;

    /**
     * Response factor for steering gliding momentum toward the current heading.
     *
     * Default is ``2.8``.
     */
    flightSteeringResponse?: number;

    /**
     * Treat arrow-key flight input as rudder/elevator control-surface
     * deflection instead of immediate yaw/pitch rate commands.
     *
     * Default is ``false``.
     */
    aircraftControlSurfaces?: boolean;

    /**
     * Response factor for rudder/elevator deflection while arrow keys are held.
     *
     * Default is ``5.5``.
     */
    controlSurfaceResponse?: number;

    /**
     * Response factor for rudder/elevator return to neutral after release.
     *
     * Default is ``3.5``.
     */
    controlSurfaceReturnResponse?: number;

    /**
     * Deprecated compatibility alias for mouse-drag yaw and pitch sensitivity.
     * Used only when ``mouseDragYawSensitivity`` or
     * ``mouseDragPitchSensitivity`` are omitted.
     *
     * Default is ``0.0024``.
     */
    relativeMouseSensitivity?: number;

    /**
     * Mouse-drag yaw sensitivity while pointer capture is active.
     *
     * Default is ``0.0034``.
     */
    mouseDragYawSensitivity?: number;

    /**
     * Mouse-drag pitch sensitivity while pointer capture is active.
     *
     * Default is ``0.0021``.
     */
    mouseDragPitchSensitivity?: number;

    /**
     * Response factor that smooths captured mouse-drag steering.
     *
     * Default is ``5.2``.
     */
    mouseDragResponse?: number;

    /**
     * Maximum captured mouse-drag yaw or pitch control deflection.
     *
     * Default is ``0.45``.
     */
    maxMouseDragInputPerFrame?: number;

    /**
     * Height gained automatically after entering flight mode.
     *
     * Default is ``4``.
     */
    flightTakeoffHeight?: number;

    /**
     * Vertical lift speed after entering flight mode, in world-space units per second.
     *
     * Default is ``7``.
     */
    flightTakeoffSpeed?: number;

    /**
     * Initial downward speed when leaving flight mode.
     *
     * Default is ``16``.
     */
    flightLandingFallSpeed?: number;

    /**
     * Forward thrust acceleration while flying.
     *
     * Default is ``13``.
     */
    flightAcceleration?: number;

    /**
     * Deceleration while holding reverse/brake in flight.
     *
     * Default is ``12``.
     */
    flightBrakeDeceleration?: number;

    /**
     * Minimum forward airspeed preserved while gliding.
     *
     * Default is ``5``.
     */
    flightMinGlideSpeed?: number;

    /**
     * Passive air drag while flying, as a response factor per second.
     *
     * Default is ``0.45``.
     */
    flightAirDrag?: number;

    /**
     * Downward acceleration while gliding, in world-space units per second squared.
     *
     * Default is ``3.2``.
     */
    flightGravity?: number;

    /**
     * Distance above a drive surface at which flight softly snaps into landing.
     *
     * Default is ``0.75``.
     */
    flightSoftLandingRange?: number;

    /**
     * Maximum height the controller can snap up/down while following a drive surface.
     *
     * Default is ``0.45``.
     */
    stepHeight?: number;

    /**
     * Maximum unsupported drop that remains snapped to the drive surface.
     * Larger unsupported drops become an actual fall.
     *
     * Default is ``1.2``.
     */
    maxFall?: number;

    /**
     * Downward acceleration while falling, in world-space units per second squared.
     *
     * Default is ``9.8``.
     */
    fallAcceleration?: number;

    /**
     * Maximum downward falling speed, in world-space units per second.
     *
     * Default is ``35``.
     */
    maxFallSpeed?: number;

    /**
     * Maximum driveable surface slope, in degrees.
     *
     * Default is ``55``.
     */
    maxSlopeDegrees?: number;

    /**
     * Only handle keyboard input while the pointer is over the View element.
     *
     * Default is ``true``.
     */
    keyboardEnabledOnlyOnMouseover?: boolean;

    /**
     * Enables horizontal obstacle tests.
     *
     * Default is ``true``.
     */
    collision?: boolean;

    /**
     * Enables drive-surface following and falling.
     *
     * Default is ``true``.
     */
    gravity?: boolean;

    /**
     * Optional object filter for horizontal obstacle tests.
     */
    obstacleFilter?: (objectId: string) => boolean;

    /**
     * Optional object filter for drive-surface raycasts.
     */
    driveSurfaceFilter?: (objectId: string) => boolean;
}
