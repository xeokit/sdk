import {SDKTask} from "../../base/core";
import type {Vec3} from "../../base/math/vector";
import {SceneRaycaster} from "../../spatial/collision";
import type {View} from "../viewer";
import type {ViewController} from "../viewController";
import type {VehicleNavigationControllerParams} from "./VehicleNavigationControllerParams";

const DEFAULT_CAMERA_HEIGHT = 1.45;
const DEFAULT_BODY_RADIUS = 0.45;
const DEFAULT_MAX_FORWARD_SPEED = 22;
const DEFAULT_MAX_REVERSE_SPEED = 5;
const DEFAULT_ACCELERATION = 9;
const DEFAULT_BRAKE_DECELERATION = 18;
const DEFAULT_COAST_DECELERATION = 5;
const DEFAULT_TURN_RATE_DEGREES_PER_SECOND = 95;
const DEFAULT_KEY_STEER_INITIAL_SCALE = 0.28;
const DEFAULT_KEY_STEER_RAMP_SECONDS = 1.45;
const DEFAULT_LEAN_DEGREES = 18;
const DEFAULT_LEAN_SMOOTHING = 8;
const DEFAULT_MAX_PITCH_DEGREES = 18;
const DEFAULT_MAX_FLIGHT_PITCH_DEGREES = 65;
const DEFAULT_FLIGHT_TAKEOFF_HEIGHT = 4;
const DEFAULT_FLIGHT_TAKEOFF_SPEED = 7;
const DEFAULT_FLIGHT_LANDING_FALL_SPEED = 16;
const DEFAULT_FLIGHT_ACCELERATION = 13;
const DEFAULT_FLIGHT_BRAKE_DECELERATION = 12;
const DEFAULT_FLIGHT_MIN_GLIDE_SPEED = 5;
const DEFAULT_FLIGHT_AIR_DRAG = 0.45;
const DEFAULT_FLIGHT_GRAVITY = 3.2;
const DEFAULT_FLIGHT_SOFT_LANDING_RANGE = 0.75;
const DEFAULT_FLIGHT_PITCH_RATE_DEGREES_PER_SECOND = 58;
const DEFAULT_FLIGHT_STEERING_RESPONSE = 2.8;
const DEFAULT_MOUSE_DRAG_YAW_SENSITIVITY = 0.0034;
const DEFAULT_MOUSE_DRAG_PITCH_SENSITIVITY = 0.0021;
const DEFAULT_MOUSE_DRAG_RESPONSE = 5.2;
const DEFAULT_MAX_MOUSE_DRAG_INPUT_PER_FRAME = 0.45;
const DEFAULT_STEP_HEIGHT = 0.45;
const DEFAULT_MAX_FALL = 1.2;
const DEFAULT_FALL_ACCELERATION = 9.8;
const DEFAULT_MAX_FALL_SPEED = 35;
const DEFAULT_MAX_SLOPE_DEGREES = 55;
const MIN_LOOK_DISTANCE = 0.01;
const MAX_FRAME_SECONDS = 0.1;
const DOWN_RAY_CLEARANCE = 0.05;

const FORWARD_KEYS = new Set(["KeyW", "w", "W"]);
const BACKWARD_KEYS = new Set(["KeyS", "s", "S"]);
const GROUND_THROTTLE_KEYS = new Set([...FORWARD_KEYS, "ArrowUp"]);
const GROUND_BRAKE_KEYS = new Set([...BACKWARD_KEYS, "ArrowDown"]);
const PITCH_UP_KEYS = new Set(["ArrowUp"]);
const PITCH_DOWN_KEYS = new Set(["ArrowDown"]);
const LEFT_KEYS = new Set(["KeyA", "a", "A", "ArrowLeft"]);
const RIGHT_KEYS = new Set(["KeyD", "d", "D", "ArrowRight"]);
const FLIGHT_TOGGLE_KEYS = new Set(["Space", " "]);
const HANDLED_KEYS = new Set([
    ...GROUND_THROTTLE_KEYS,
    ...GROUND_BRAKE_KEYS,
    ...LEFT_KEYS,
    ...RIGHT_KEYS,
    ...FLIGHT_TOGGLE_KEYS
]);

/**
 * Opt-in vehicle-style navigation for moving through large models.
 *
 * ``VehicleNavigationController`` keeps a current speed instead of applying
 * instant walk steps. ``W``/``S`` accelerate and brake, ``A``/``D`` and the
 * left/right arrow keys ramp into turns, and click-drag steers yaw/pitch like
 * the procedural city vehicle demo. The camera rolls into turns like a bicycle
 * or motorcycle. ``Space`` toggles flight mode: the vehicle detaches and lifts
 * off, then can glide on its own momentum and softly land on a drive surface.
 * It can also follow drive surfaces and block movement through obstacles using
 * Scene raycasts.
 */
export class VehicleNavigationController {

    /**
     * The View navigated by this controller.
     */
    readonly view: View;

    /**
     * Raycaster used for drive-surface following and obstacle checks.
     */
    readonly raycaster: SceneRaycaster;

    #active = false;
    #destroyed = false;
    #keysDown = new Set<string>();
    #mouseOver = false;
    #pointerId: number | null = null;
    #pointerLastX = 0;
    #pointerLastY = 0;
    #lastTime = performance.now();
    #task: SDKTask;
    #viewElement: HTMLElement;
    #suspendViewController?: ViewController;
    #suspendedViewControllerActive: boolean | null = null;
    #unsubscribeViewDestroyed?: () => void;

    #cameraHeight: number;
    #bodyRadius: number;
    #maxForwardSpeed: number;
    #maxReverseSpeed: number;
    #acceleration: number;
    #brakeDeceleration: number;
    #coastDeceleration: number;
    #turnRateRadiansPerSecond: number;
    #keySteerInitialScale: number;
    #keySteerRampSeconds: number;
    #keySteerHoldSeconds = 0;
    #keySteerDirection = 0;
    #leanRadians: number;
    #leanSmoothing: number;
    #currentLean = 0;
    #maxPitchRadians: number;
    #maxFlightPitchRadians: number;
    #flightTakeoffHeight: number;
    #flightTakeoffSpeed: number;
    #flightLandingFallSpeed: number;
    #flightAcceleration: number;
    #flightBrakeDeceleration: number;
    #flightMinGlideSpeed: number;
    #flightAirDrag: number;
    #flightGravity: number;
    #flightSoftLandingRange: number;
    #flightPitchRateRadiansPerSecond: number;
    #flightSteeringResponse: number;
    #mouseDragYawSensitivity: number;
    #mouseDragPitchSensitivity: number;
    #mouseDragResponse: number;
    #maxMouseDragInputPerFrame: number;
    #relativeYawInput = 0;
    #relativePitchInput = 0;
    #mouseDragYawInput = 0;
    #mouseDragPitchInput = 0;
    #flightVelocity: Vec3 = [0, 0, 0];
    #flying = false;
    #landingAfterFlight = false;
    #flightLiftRemaining = 0;
    #stepHeight: number;
    #maxFall: number;
    #fallAcceleration: number;
    #maxFallSpeed: number;
    #fallSpeed = 0;
    #driveableDot: number;
    #keyboardEnabledOnlyOnMouseover: boolean;
    #collision: boolean;
    #gravity: boolean;
    #speed = 0;
    #obstacleFilter?: (objectId: string) => boolean;
    #driveSurfaceFilter?: (objectId: string) => boolean;

    constructor(view: View, params: VehicleNavigationControllerParams = {}) {
        this.view = view;
        this.raycaster = params.raycaster || new SceneRaycaster(view.viewer.scene);
        this.#viewElement = view.htmlElement;
        this.#suspendViewController = params.suspendViewController;
        this.#cameraHeight = params.cameraHeight ?? DEFAULT_CAMERA_HEIGHT;
        this.#bodyRadius = params.bodyRadius ?? DEFAULT_BODY_RADIUS;
        this.#maxForwardSpeed = Math.max(0, params.maxForwardSpeed ?? DEFAULT_MAX_FORWARD_SPEED);
        this.#maxReverseSpeed = Math.max(0, params.maxReverseSpeed ?? DEFAULT_MAX_REVERSE_SPEED);
        this.#acceleration = Math.max(0, params.acceleration ?? DEFAULT_ACCELERATION);
        this.#brakeDeceleration = Math.max(0, params.brakeDeceleration ?? DEFAULT_BRAKE_DECELERATION);
        this.#coastDeceleration = Math.max(0, params.coastDeceleration ?? DEFAULT_COAST_DECELERATION);
        this.#turnRateRadiansPerSecond = degreesToRadians(params.turnRateDegreesPerSecond ?? DEFAULT_TURN_RATE_DEGREES_PER_SECOND);
        this.#keySteerInitialScale = clamp(params.keySteerInitialScale ?? DEFAULT_KEY_STEER_INITIAL_SCALE, 0, 1);
        this.#keySteerRampSeconds = Math.max(0.001, params.keySteerRampSeconds ?? DEFAULT_KEY_STEER_RAMP_SECONDS);
        this.#leanRadians = degreesToRadians(params.leanDegrees ?? DEFAULT_LEAN_DEGREES);
        this.#leanSmoothing = Math.max(0, params.leanSmoothing ?? DEFAULT_LEAN_SMOOTHING);
        this.#maxPitchRadians = degreesToRadians(params.maxPitchDegrees ?? DEFAULT_MAX_PITCH_DEGREES);
        this.#maxFlightPitchRadians = degreesToRadians(params.maxFlightPitchDegrees ?? DEFAULT_MAX_FLIGHT_PITCH_DEGREES);
        this.#flightTakeoffHeight = Math.max(0, params.flightTakeoffHeight ?? DEFAULT_FLIGHT_TAKEOFF_HEIGHT);
        this.#flightTakeoffSpeed = Math.max(0, params.flightTakeoffSpeed ?? DEFAULT_FLIGHT_TAKEOFF_SPEED);
        this.#flightLandingFallSpeed = Math.max(0, params.flightLandingFallSpeed ?? DEFAULT_FLIGHT_LANDING_FALL_SPEED);
        this.#flightAcceleration = Math.max(0, params.flightAcceleration ?? DEFAULT_FLIGHT_ACCELERATION);
        this.#flightBrakeDeceleration = Math.max(0, params.flightBrakeDeceleration ?? DEFAULT_FLIGHT_BRAKE_DECELERATION);
        this.#flightMinGlideSpeed = Math.max(0, params.flightMinGlideSpeed ?? DEFAULT_FLIGHT_MIN_GLIDE_SPEED);
        this.#flightAirDrag = Math.max(0, params.flightAirDrag ?? DEFAULT_FLIGHT_AIR_DRAG);
        this.#flightGravity = Math.max(0, params.flightGravity ?? DEFAULT_FLIGHT_GRAVITY);
        this.#flightSoftLandingRange = Math.max(0, params.flightSoftLandingRange ?? DEFAULT_FLIGHT_SOFT_LANDING_RANGE);
        this.#flightPitchRateRadiansPerSecond = degreesToRadians(params.flightPitchRateDegreesPerSecond ?? DEFAULT_FLIGHT_PITCH_RATE_DEGREES_PER_SECOND);
        this.#flightSteeringResponse = Math.max(0, params.flightSteeringResponse ?? DEFAULT_FLIGHT_STEERING_RESPONSE);
        this.#mouseDragYawSensitivity = Math.max(0, params.mouseDragYawSensitivity ?? params.relativeMouseSensitivity ?? DEFAULT_MOUSE_DRAG_YAW_SENSITIVITY);
        this.#mouseDragPitchSensitivity = Math.max(0, params.mouseDragPitchSensitivity ?? params.relativeMouseSensitivity ?? DEFAULT_MOUSE_DRAG_PITCH_SENSITIVITY);
        this.#mouseDragResponse = Math.max(0, params.mouseDragResponse ?? DEFAULT_MOUSE_DRAG_RESPONSE);
        this.#maxMouseDragInputPerFrame = Math.max(0, params.maxMouseDragInputPerFrame ?? DEFAULT_MAX_MOUSE_DRAG_INPUT_PER_FRAME);
        this.#stepHeight = Math.max(0, params.stepHeight ?? DEFAULT_STEP_HEIGHT);
        this.#maxFall = Math.max(0, params.maxFall ?? DEFAULT_MAX_FALL);
        this.#fallAcceleration = Math.max(0, params.fallAcceleration ?? DEFAULT_FALL_ACCELERATION);
        this.#maxFallSpeed = Math.max(0, params.maxFallSpeed ?? DEFAULT_MAX_FALL_SPEED);
        this.#driveableDot = Math.cos(degreesToRadians(params.maxSlopeDegrees ?? DEFAULT_MAX_SLOPE_DEGREES));
        this.#keyboardEnabledOnlyOnMouseover = params.keyboardEnabledOnlyOnMouseover ?? true;
        this.#collision = params.collision ?? true;
        this.#gravity = params.gravity ?? true;
        this.#obstacleFilter = params.obstacleFilter;
        this.#driveSurfaceFilter = params.driveSurfaceFilter;

        this.#bindEvents();
        this.#task = new SDKTask({
            name: "VehicleNavigationController",
            stage: SDKTask.CollectInputStage,
            repeat: true,
            task: () => this.#update()
        });
        this.#unsubscribeViewDestroyed = view.viewer.events.onViewDestroyed.subscribe((_, destroyedView) => {
            if (destroyedView === view) {
                this.destroy();
            }
        });
        this.active = params.active ?? true;
    }

    /**
     * Whether vehicle navigation is active.
     */
    set active(active: boolean) {
        if (this.#destroyed || active === this.#active) {
            return;
        }
        this.#active = active;
        this.#lastTime = performance.now();
        this.#keysDown.clear();
        this.#fallSpeed = 0;
        this.#flying = false;
        this.#landingAfterFlight = false;
        this.#flightLiftRemaining = 0;
        this.#flightVelocity = [0, 0, 0];
        this.#keySteerHoldSeconds = 0;
        this.#keySteerDirection = 0;
        this.#relativeYawInput = 0;
        this.#relativePitchInput = 0;
        this.#mouseDragYawInput = 0;
        this.#mouseDragPitchInput = 0;
        if (active) {
            this.#suspendDefaultController();
        } else {
            this.#restoreDefaultController();
        }
    }

    get active(): boolean {
        return this.#active;
    }

    /**
     * Whether vehicle navigation is currently flying.
     *
     * Set to ``true`` to detach from the drive surface and lift off. Set to
     * ``false`` to drop back to the nearest driveable ground or rooftop.
     */
    set flying(flying: boolean) {
        if (this.#destroyed || flying === this.#flying) {
            return;
        }
        this.#flying = flying;
        if (flying) {
            const up = this.#worldUp();
            const basis = cameraBasis(this.view.camera.eye, this.view.camera.look, up);
            this.#flightVelocity = mul(basis.flatForward, Math.max(this.#speed, this.#effectiveMinGlideSpeed()));
            this.#fallSpeed = 0;
            this.#landingAfterFlight = false;
            this.#flightLiftRemaining = this.#flightTakeoffHeight;
        } else {
            this.#flightVelocity = [0, 0, 0];
            this.#flightLiftRemaining = 0;
            this.#landingAfterFlight = true;
            this.#fallSpeed = Math.max(this.#fallSpeed, this.#flightLandingFallSpeed);
        }
    }

    get flying(): boolean {
        return this.#flying;
    }

    /**
     * Current signed speed in world-space units per second.
     */
    set speed(speed: number) {
        this.#speed = clamp(speed, -this.#maxReverseSpeed, this.#maxForwardSpeed);
    }

    get speed(): number {
        return this.#speed;
    }

    /**
     * Camera height above the driven surface.
     */
    set cameraHeight(cameraHeight: number) {
        this.#cameraHeight = Math.max(0.01, cameraHeight);
    }

    get cameraHeight(): number {
        return this.#cameraHeight;
    }

    /**
     * Maximum forward speed in world-space units per second.
     */
    set maxForwardSpeed(maxForwardSpeed: number) {
        this.#maxForwardSpeed = Math.max(0, maxForwardSpeed);
        this.speed = this.#speed;
    }

    get maxForwardSpeed(): number {
        return this.#maxForwardSpeed;
    }

    /**
     * Maximum reverse speed in world-space units per second.
     */
    set maxReverseSpeed(maxReverseSpeed: number) {
        this.#maxReverseSpeed = Math.max(0, maxReverseSpeed);
        this.speed = this.#speed;
    }

    get maxReverseSpeed(): number {
        return this.#maxReverseSpeed;
    }

    /**
     * Forward acceleration in world-space units per second squared.
     */
    set acceleration(acceleration: number) {
        this.#acceleration = Math.max(0, acceleration);
    }

    get acceleration(): number {
        return this.#acceleration;
    }

    /**
     * Forward thrust acceleration while flying.
     */
    set flightAcceleration(flightAcceleration: number) {
        this.#flightAcceleration = Math.max(0, flightAcceleration);
    }

    get flightAcceleration(): number {
        return this.#flightAcceleration;
    }

    /**
     * Braking deceleration when pressing reverse while moving forward.
     */
    set brakeDeceleration(brakeDeceleration: number) {
        this.#brakeDeceleration = Math.max(0, brakeDeceleration);
    }

    get brakeDeceleration(): number {
        return this.#brakeDeceleration;
    }

    /**
     * Deceleration while holding reverse/brake in flight.
     */
    set flightBrakeDeceleration(flightBrakeDeceleration: number) {
        this.#flightBrakeDeceleration = Math.max(0, flightBrakeDeceleration);
    }

    get flightBrakeDeceleration(): number {
        return this.#flightBrakeDeceleration;
    }

    /**
     * Minimum forward airspeed preserved while gliding.
     */
    set flightMinGlideSpeed(flightMinGlideSpeed: number) {
        this.#flightMinGlideSpeed = Math.max(0, flightMinGlideSpeed);
    }

    get flightMinGlideSpeed(): number {
        return this.#flightMinGlideSpeed;
    }

    /**
     * Passive deceleration when no throttle or brake key is pressed.
     */
    set coastDeceleration(coastDeceleration: number) {
        this.#coastDeceleration = Math.max(0, coastDeceleration);
    }

    get coastDeceleration(): number {
        return this.#coastDeceleration;
    }

    /**
     * Maximum camera roll into turns, in degrees.
     */
    set leanDegrees(leanDegrees: number) {
        this.#leanRadians = degreesToRadians(leanDegrees);
    }

    get leanDegrees(): number {
        return radiansToDegrees(this.#leanRadians);
    }

    /**
     * Destroys this controller and restores any suspended ViewController.
     */
    destroy(): void {
        if (this.#destroyed) {
            return;
        }
        this.active = false;
        this.#destroyed = true;
        this.#task.destroy();
        this.#unbindEvents();
        if (this.#unsubscribeViewDestroyed) {
            this.#unsubscribeViewDestroyed();
            this.#unsubscribeViewDestroyed = undefined;
        }
    }

    #suspendDefaultController(): void {
        if (!this.#suspendViewController || this.#suspendedViewControllerActive !== null) {
            return;
        }
        this.#suspendedViewControllerActive = this.#suspendViewController.active;
        this.#suspendViewController.active = false;
    }

    #restoreDefaultController(): void {
        if (!this.#suspendViewController || this.#suspendedViewControllerActive === null) {
            return;
        }
        this.#suspendViewController.active = this.#suspendedViewControllerActive;
        this.#suspendedViewControllerActive = null;
    }

    #bindEvents(): void {
        this.#viewElement.addEventListener("mouseenter", this.#onMouseEnter);
        this.#viewElement.addEventListener("mouseleave", this.#onMouseLeave);
        this.#viewElement.addEventListener("pointerdown", this.#onPointerDown);
        this.#viewElement.addEventListener("pointermove", this.#onPointerMove);
        this.#viewElement.addEventListener("pointerup", this.#onPointerUp);
        this.#viewElement.addEventListener("pointercancel", this.#onPointerUp);
        document.addEventListener("keydown", this.#onKeyDown);
        document.addEventListener("keyup", this.#onKeyUp);
        window.addEventListener("blur", this.#onWindowBlur);
    }

    #unbindEvents(): void {
        this.#viewElement.removeEventListener("mouseenter", this.#onMouseEnter);
        this.#viewElement.removeEventListener("mouseleave", this.#onMouseLeave);
        this.#viewElement.removeEventListener("pointerdown", this.#onPointerDown);
        this.#viewElement.removeEventListener("pointermove", this.#onPointerMove);
        this.#viewElement.removeEventListener("pointerup", this.#onPointerUp);
        this.#viewElement.removeEventListener("pointercancel", this.#onPointerUp);
        document.removeEventListener("keydown", this.#onKeyDown);
        document.removeEventListener("keyup", this.#onKeyUp);
        window.removeEventListener("blur", this.#onWindowBlur);
    }

    #onMouseEnter = (): void => {
        this.#mouseOver = true;
    };

    #onMouseLeave = (): void => {
        this.#mouseOver = false;
    };

    #onPointerDown = (event: PointerEvent): void => {
        if (!this.#active || event.button !== 0) {
            return;
        }
        this.#pointerId = event.pointerId;
        this.#pointerLastX = event.clientX;
        this.#pointerLastY = event.clientY;
        this.#relativeYawInput = 0;
        this.#relativePitchInput = 0;
        this.#mouseDragYawInput = 0;
        this.#mouseDragPitchInput = 0;
        this.#viewElement.setPointerCapture?.(event.pointerId);
        event.preventDefault();
    };

    #onPointerMove = (event: PointerEvent): void => {
        if (!this.#active) {
            return;
        }
        if (this.#pointerId === null) {
            return;
        }
        if (event.pointerId !== this.#pointerId) {
            return;
        }
        this.#updatePointerDragFromEvent(event);
        event.preventDefault();
    };

    #onPointerUp = (event: PointerEvent): void => {
        if (event.pointerId !== this.#pointerId) {
            return;
        }
        this.#pointerId = null;
        this.#relativeYawInput = 0;
        this.#relativePitchInput = 0;
        this.#viewElement.releasePointerCapture?.(event.pointerId);
    };

    #onKeyDown = (event: KeyboardEvent): void => {
        if (!this.#shouldHandleKeyEvent(event)) {
            return;
        }
        const code = keyCode(event);
        if (FLIGHT_TOGGLE_KEYS.has(code)) {
            if (!event.repeat) {
                this.flying = !this.#flying;
            }
            event.preventDefault();
            return;
        }
        if (!HANDLED_KEYS.has(code)) {
            return;
        }
        this.#keysDown.add(code);
        event.preventDefault();
    };

    #onKeyUp = (event: KeyboardEvent): void => {
        const code = keyCode(event);
        if (!HANDLED_KEYS.has(code)) {
            return;
        }
        this.#keysDown.delete(code);
        if (this.#active) {
            event.preventDefault();
        }
    };

    #onWindowBlur = (): void => {
        this.#keysDown.clear();
        this.#pointerId = null;
        this.#relativeYawInput = 0;
        this.#relativePitchInput = 0;
        this.#mouseDragYawInput = 0;
        this.#mouseDragPitchInput = 0;
        this.#keySteerHoldSeconds = 0;
        this.#keySteerDirection = 0;
    };

    #shouldHandleKeyEvent(event: KeyboardEvent): boolean {
        if (!this.#active) {
            return false;
        }
        if (this.#keyboardEnabledOnlyOnMouseover && !this.#mouseOver) {
            return false;
        }
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return true;
        }
        const tagName = target.tagName.toLowerCase();
        return tagName !== "input" && tagName !== "textarea" && tagName !== "select" && !target.isContentEditable;
    }

    #updatePointerDragFromEvent(event: PointerEvent): void {
        const movementX = Number.isFinite(event.movementX) && event.movementX !== 0
            ? event.movementX
            : event.clientX - this.#pointerLastX;
        const movementY = Number.isFinite(event.movementY) && event.movementY !== 0
            ? event.movementY
            : event.clientY - this.#pointerLastY;
        this.#pointerLastX = event.clientX;
        this.#pointerLastY = event.clientY;
        this.#relativeYawInput += movementX * this.#mouseDragYawSensitivity;
        this.#relativePitchInput -= movementY * this.#mouseDragPitchSensitivity;
    }

    #update(): void {
        if (!this.#active || this.#destroyed) {
            return;
        }
        const now = performance.now();
        const elapsedSeconds = Math.min((now - this.#lastTime) / 1000, MAX_FRAME_SECONDS);
        this.#lastTime = now;
        if (elapsedSeconds <= 0) {
            return;
        }

        const up = this.#worldUp();
        const camera = this.view.camera;
        const basis = cameraBasis(camera.eye, camera.look, up);
        const throttle = this.#throttleInput();
        if (!this.#flying) {
            this.#updateSpeed(throttle, elapsedSeconds);
        }

        const steering = this.#steeringInput(elapsedSeconds);
        const rawDragYawInput = this.#mouseDragYawTargetInput();
        const rawDragPitchInput = this.#mouseDragPitchTargetInput();
        const dragT = this.#mouseDragResponse === 0 ? 1 : 1 - Math.exp(-this.#mouseDragResponse * elapsedSeconds);
        this.#mouseDragYawInput = lerpNumber(this.#mouseDragYawInput, rawDragYawInput, dragT);
        this.#mouseDragPitchInput = lerpNumber(this.#mouseDragPitchInput, rawDragPitchInput, dragT);
        const currentTravelSpeed = this.#flying ? length(this.#flightVelocity) : Math.abs(this.#speed);
        const speedRatio = this.#maxForwardSpeed > 0 ? Math.min(currentTravelSpeed / this.#maxForwardSpeed, 1) : 0;
        const yawControl = clamp(steering + this.#mouseDragYawInput, -1, 1);
        const controlTurnScaleFloor = Math.abs(yawControl) > 0.0001
            ? Math.max(this.#keySteerInitialScale, 0.55)
            : 0;
        const turnSpeedScale = Math.max(controlTurnScaleFloor, clamp(speedRatio * 1.4, 0, 1));
        const directionSign = this.#flying
            ? (dot(this.#flightVelocity, basis.flatForward) < 0 ? -1 : 1)
            : (this.#speed < 0 ? -1 : 1);
        const yaw = -yawControl * this.#turnRateRadiansPerSecond * elapsedSeconds * turnSpeedScale * directionSign;
        const flatForward = normalize(rotateAroundAxis(basis.flatForward, up, yaw));
        const pitchLimit = this.#flying ? this.#maxFlightPitchRadians : this.#maxPitchRadians;
        const pitch = this.#pitchInput(basis.pitch, pitchLimit, elapsedSeconds, this.#mouseDragPitchInput);
        const pitchControlActive = this.#flying && this.#pitchControlActive();
        const direction = normalize(add(mul(flatForward, Math.cos(pitch)), mul(up, Math.sin(pitch))));

        let move: Vec3;
        if (this.#flying) {
            this.#updateFlightVelocity(throttle, direction, up, pitchControlActive, elapsedSeconds);
            move = mul(this.#flightVelocity, elapsedSeconds);
            if (this.#flightLiftRemaining > 0) {
                const lift = Math.min(this.#flightLiftRemaining, this.#flightTakeoffSpeed * elapsedSeconds);
                this.#flightLiftRemaining -= lift;
                move = add(move, mul(up, lift));
            }
        } else {
            move = mul(flatForward, this.#speed * elapsedSeconds);
        }

        this.#move(move, direction, up, yawControl, turnSpeedScale, elapsedSeconds);
    }

    #updateFlightVelocity(throttle: number, direction: Vec3, up: Vec3, pitchControlActive: boolean, elapsedSeconds: number): void {
        if (throttle > 0) {
            this.#flightVelocity = add(this.#flightVelocity, mul(direction, this.#flightAcceleration * elapsedSeconds));
        } else if (throttle < 0) {
            this.#flightVelocity = moveVectorTowardsZero(this.#flightVelocity, this.#flightBrakeDeceleration * elapsedSeconds);
        }

        this.#flightVelocity = add(this.#flightVelocity, mul(up, -this.#flightGravity * elapsedSeconds));

        if (this.#flightAirDrag > 0) {
            this.#flightVelocity = mul(this.#flightVelocity, Math.exp(-this.#flightAirDrag * elapsedSeconds));
        }

        this.#flightVelocity = this.#steerFlightVelocity(this.#flightVelocity, direction, up, throttle > 0 || pitchControlActive, elapsedSeconds);
        this.#flightVelocity = this.#withMinimumForwardGlide(this.#flightVelocity, direction);
        const flightSpeed = length(this.#flightVelocity);
        if (this.#maxForwardSpeed > 0 && flightSpeed > this.#maxForwardSpeed) {
            this.#flightVelocity = mul(this.#flightVelocity, this.#maxForwardSpeed / flightSpeed);
        }
        this.#speed = this.#flightVelocitySpeed(direction);
    }

    #updateSpeed(throttle: number, elapsedSeconds: number): void {
        if (throttle > 0) {
            this.#speed = moveTowards(this.#speed, this.#maxForwardSpeed, this.#acceleration * elapsedSeconds);
        } else if (throttle < 0) {
            if (this.#speed > 0) {
                this.#speed = moveTowards(this.#speed, 0, this.#brakeDeceleration * elapsedSeconds);
            } else {
                this.#speed = moveTowards(this.#speed, -this.#maxReverseSpeed, this.#acceleration * 0.65 * elapsedSeconds);
            }
        } else {
            this.#speed = moveTowards(this.#speed, 0, this.#coastDeceleration * elapsedSeconds);
        }
        this.#speed = clamp(this.#speed, -this.#maxReverseSpeed, this.#maxForwardSpeed);
    }

    #steeringInput(elapsedSeconds: number): number {
        const keyInput = pressed(this.#keysDown, RIGHT_KEYS) - pressed(this.#keysDown, LEFT_KEYS);
        if (keyInput === 0) {
            this.#keySteerHoldSeconds = 0;
            this.#keySteerDirection = 0;
            return 0;
        }
        const direction = Math.sign(keyInput);
        if (direction !== this.#keySteerDirection) {
            this.#keySteerHoldSeconds = 0;
            this.#keySteerDirection = direction;
        }
        this.#keySteerHoldSeconds += elapsedSeconds;
        const t = clamp(this.#keySteerHoldSeconds / this.#keySteerRampSeconds, 0, 1);
        const easedT = t * t * (3 - 2 * t);
        return keyInput * (this.#keySteerInitialScale + (1 - this.#keySteerInitialScale) * easedT);
    }

    #throttleInput(): number {
        if (this.#flying) {
            return pressed(this.#keysDown, FORWARD_KEYS) - pressed(this.#keysDown, BACKWARD_KEYS);
        }
        return pressed(this.#keysDown, GROUND_THROTTLE_KEYS) - pressed(this.#keysDown, GROUND_BRAKE_KEYS);
    }

    #pitchControlActive(): boolean {
        return pressed(this.#keysDown, PITCH_UP_KEYS) !== 0
            || pressed(this.#keysDown, PITCH_DOWN_KEYS) !== 0
            || Math.abs(this.#mouseDragPitchInput) > 0.0001;
    }

    #pitchInput(currentPitch: number, pitchLimit: number, elapsedSeconds: number, mouseDragPitchInput: number): number {
        const dragPitchDelta = mouseDragPitchInput * this.#flightPitchRateRadiansPerSecond * elapsedSeconds;
        if (this.#flying) {
            const keyPitch = pressed(this.#keysDown, PITCH_UP_KEYS) - pressed(this.#keysDown, PITCH_DOWN_KEYS);
            if (keyPitch !== 0 || dragPitchDelta !== 0) {
                return clamp(currentPitch + keyPitch * this.#flightPitchRateRadiansPerSecond * elapsedSeconds + dragPitchDelta, -pitchLimit, pitchLimit);
            }
            return clamp(currentPitch, -pitchLimit, pitchLimit);
        }
        if (dragPitchDelta !== 0) {
            return clamp(currentPitch + dragPitchDelta, -pitchLimit, pitchLimit);
        }
        return clamp(currentPitch, -pitchLimit, pitchLimit);
    }

    #mouseDragYawTargetInput(): number {
        return clamp(this.#relativeYawInput, -this.#maxMouseDragInputPerFrame, this.#maxMouseDragInputPerFrame);
    }

    #mouseDragPitchTargetInput(): number {
        return clamp(this.#relativePitchInput, -this.#maxMouseDragInputPerFrame, this.#maxMouseDragInputPerFrame);
    }

    #move(move: Vec3, viewDirection: Vec3, up: Vec3, steering: number, turnSpeedScale: number, elapsedSeconds: number): void {
        const camera = this.view.camera;
        const oldEye = [...camera.eye] as Vec3;
        const oldGround = sub(oldEye, mul(up, this.#cameraHeight));
        const moveDistance = length(move);

        let ground = moveDistance === 0 ? oldGround : add(oldGround, move);
        if (!this.#flying && moveDistance > 0 && this.#collision && this.#isBlocked(oldGround, move, moveDistance, up)) {
            ground = oldGround;
            this.#speed = 0;
        }

        if (this.#flying && dot(move, up) <= 0) {
            const landedGround = this.#flightLandingSurface(oldGround, move, up);
            if (landedGround) {
                ground = landedGround;
                this.#landFromFlight(viewDirection, up);
            }
        }

        if (this.#flying && moveDistance > 0 && this.#collision && this.#isFlightBlocked(oldEye, move, moveDistance, up)) {
            ground = oldGround;
            this.#flightVelocity = [0, 0, 0];
            this.#speed = 0;
        }

        if (!this.#flying && (this.#gravity || this.#landingAfterFlight)) {
            ground = this.#groundedPoint(ground, up, elapsedSeconds);
            if (this.#fallSpeed === 0) {
                this.#landingAfterFlight = false;
            }
        }

        const newEye = add(ground, mul(up, this.#cameraHeight));
        const lookDistance = Math.max(distance(camera.eye, camera.look), MIN_LOOK_DISTANCE);
        const desiredLean = steering * this.#leanRadians * turnSpeedScale;
        const leanT = clamp(this.#leanSmoothing * elapsedSeconds, 0, 1);
        this.#currentLean += (desiredLean - this.#currentLean) * leanT;
        const rollAxis = flatDirection(viewDirection, up);

        camera.eye = newEye;
        camera.look = add(newEye, mul(viewDirection, lookDistance));
        camera.up = normalize(rotateAroundAxis(up, rollAxis, this.#currentLean));
    }

    #flightLandingSurface(oldGround: Vec3, move: Vec3, up: Vec3): Vec3 | null {
        const downwardDistance = Math.max(0, -dot(move, up));
        const verticalMove = mul(up, dot(move, up));
        const horizontalMove = sub(move, verticalMove);
        const rayOrigins = [
            oldGround,
            add(oldGround, mul(horizontalMove, 0.5)),
            add(oldGround, horizontalMove)
        ];
        for (const origin of rayOrigins) {
            const rayOrigin = add(origin, mul(up, DOWN_RAY_CLEARANCE));
            const result = this.raycaster.pick({
                view: this.view,
                ray: {origin: rayOrigin, dir: mul(up, -1)},
                tMin: 0,
                tMax: downwardDistance + this.#flightSoftLandingRange + DOWN_RAY_CLEARANCE,
                pickSurfaceNormal: true,
                filter: this.#driveSurfaceFilter
            });
            if (result.ok && result.value.hit && result.value.worldPos && this.#isDriveableNormal(result.value.worldNormal, up)) {
                return [...result.value.worldPos] as Vec3;
            }
        }
        return null;
    }

    #landFromFlight(viewDirection: Vec3, up: Vec3): void {
        const groundForward = flatDirection(viewDirection, up);
        this.#speed = clamp(dot(this.#flightVelocity, groundForward), -this.#maxReverseSpeed, this.#maxForwardSpeed);
        this.#flightVelocity = [0, 0, 0];
        this.#flying = false;
        this.#landingAfterFlight = false;
        this.#flightLiftRemaining = 0;
        this.#fallSpeed = 0;
    }

    #flightVelocitySpeed(direction: Vec3): number {
        const signedSpeed = dot(this.#flightVelocity, direction);
        const flightSpeed = length(this.#flightVelocity);
        if (Math.abs(signedSpeed) < 0.0001) {
            return flightSpeed;
        }
        return Math.sign(signedSpeed) * flightSpeed;
    }

    #withMinimumForwardGlide(velocity: Vec3, forward: Vec3): Vec3 {
        const minForwardSpeed = this.#effectiveMinGlideSpeed();
        if (minForwardSpeed === 0) {
            return velocity;
        }
        const forwardSpeed = dot(velocity, forward);
        if (forwardSpeed >= minForwardSpeed) {
            return velocity;
        }
        return add(velocity, mul(forward, minForwardSpeed - forwardSpeed));
    }

    #steerFlightVelocity(velocity: Vec3, direction: Vec3, up: Vec3, steerVertically: boolean, elapsedSeconds: number): Vec3 {
        if (this.#flightSteeringResponse === 0) {
            return velocity;
        }
        const speed = length(velocity);
        if (speed < 0.0001) {
            return velocity;
        }
        let desiredVelocity: Vec3;
        if (steerVertically) {
            desiredVelocity = mul(direction, speed);
        } else {
            const verticalSpeed = dot(velocity, up);
            const verticalVelocity = mul(up, verticalSpeed);
            const horizontalVelocity = sub(velocity, verticalVelocity);
            const horizontalSpeed = length(horizontalVelocity);
            desiredVelocity = add(mul(flatDirection(direction, up), horizontalSpeed), verticalVelocity);
        }
        const response = 1 - Math.exp(-this.#flightSteeringResponse * elapsedSeconds);
        return lerp(velocity, desiredVelocity, clamp(response, 0, 1));
    }

    #effectiveMinGlideSpeed(): number {
        if (this.#maxForwardSpeed === 0) {
            return 0;
        }
        return Math.min(this.#flightMinGlideSpeed, this.#maxForwardSpeed);
    }

    #isBlocked(originGround: Vec3, move: Vec3, moveDistance: number, up: Vec3): boolean {
        const direction = normalize(move);
        const heights = [Math.max(this.#bodyRadius, 0.05), Math.max(this.#cameraHeight * 0.62, this.#bodyRadius)];
        const tMax = moveDistance + this.#bodyRadius;
        for (const height of heights) {
            const origin = add(originGround, mul(up, height));
            const result = this.raycaster.pick({
                view: this.view,
                ray: {origin, dir: direction},
                tMin: 0,
                tMax,
                pickSurfaceNormal: true,
                filter: this.#obstacleFilter
            });
            if (result.ok && result.value.hit && !this.#isDriveableNormal(result.value.worldNormal, up)) {
                return true;
            }
        }
        return false;
    }

    #isFlightBlocked(originEye: Vec3, move: Vec3, moveDistance: number, up: Vec3): boolean {
        const direction = normalize(move);
        const right = safePerpendicular(direction, up);
        const offsets = [
            [0, 0],
            [this.#bodyRadius, 0],
            [-this.#bodyRadius, 0],
            [0, this.#bodyRadius],
            [0, -this.#bodyRadius]
        ];
        for (const [rightOffset, upOffset] of offsets) {
            const origin = add(add(originEye, mul(right, rightOffset)), mul(up, upOffset));
            const result = this.raycaster.pick({
                view: this.view,
                ray: {origin, dir: direction},
                tMin: 0.05,
                tMax: moveDistance + this.#bodyRadius,
                pickSurfaceNormal: true,
                filter: this.#obstacleFilter
            });
            if (result.ok && result.value.hit && !this.#isDriveableNormal(result.value.worldNormal, up)) {
                return true;
            }
        }
        return false;
    }

    #groundedPoint(candidateGround: Vec3, up: Vec3, elapsedSeconds: number): Vec3 {
        const nextFallSpeed = Math.min(this.#maxFallSpeed, this.#fallSpeed + this.#fallAcceleration * elapsedSeconds);
        const fallDistance = (this.#fallSpeed + nextFallSpeed) * 0.5 * elapsedSeconds;
        const surface = this.#driveSurfaceAt(candidateGround, this.#stepHeight + Math.max(this.#maxFall, fallDistance), up);
        if (surface) {
            this.#fallSpeed = 0;
            return surface;
        }
        this.#fallSpeed = nextFallSpeed;
        return add(candidateGround, mul(up, -fallDistance));
    }

    #driveSurfaceAt(candidateGround: Vec3, verticalRange: number, up: Vec3): Vec3 | null {
        const rayOrigin = add(candidateGround, mul(up, this.#stepHeight + DOWN_RAY_CLEARANCE));
        const rayDirection = mul(up, -1);
        const result = this.raycaster.pick({
            view: this.view,
            ray: {origin: rayOrigin, dir: rayDirection},
            tMin: 0,
            tMax: verticalRange + DOWN_RAY_CLEARANCE,
            pickSurfaceNormal: true,
            filter: this.#driveSurfaceFilter
        });
        if (result.ok && result.value.hit && result.value.worldPos && this.#isDriveableNormal(result.value.worldNormal, up)) {
            return [...result.value.worldPos] as Vec3;
        }
        return null;
    }

    #isDriveableNormal(normal: Vec3 | null | undefined, up: Vec3): boolean {
        if (!normal) {
            return false;
        }
        return Math.abs(dot(normalize(normal), up)) >= this.#driveableDot;
    }

    #worldUp(): Vec3 {
        return normalize(this.view.viewer.scene.coordinateSystem.worldUp);
    }
}

function cameraBasis(eye: Vec3, look: Vec3, up: Vec3): { direction: Vec3; flatForward: Vec3; right: Vec3; pitch: number } {
    const direction = normalize(sub(look, eye));
    const flatForward = flatDirection(direction, up);
    const right = normalize(cross(flatForward, up));
    const pitch = Math.asin(clamp(dot(direction, up), -1, 1));
    return {direction, flatForward, right, pitch};
}

function flatDirection(direction: Vec3, up: Vec3): Vec3 {
    let flatForward = sub(direction, mul(up, dot(direction, up)));
    if (length(flatForward) < 0.00001) {
        flatForward = perpendicular(up);
    } else {
        flatForward = normalize(flatForward);
    }
    return flatForward;
}

function pressed(keysDown: Set<string>, keys: Set<string>): number {
    for (const key of keys) {
        if (keysDown.has(key)) {
            return 1;
        }
    }
    return 0;
}

function keyCode(event: KeyboardEvent): string {
    return event.code || event.key;
}

function moveTowards(value: number, target: number, maxDelta: number): number {
    if (Math.abs(target - value) <= maxDelta) {
        return target;
    }
    return value + Math.sign(target - value) * maxDelta;
}

function moveVectorTowardsZero(value: Vec3, maxDelta: number): Vec3 {
    const len = length(value);
    if (len <= maxDelta) {
        return [0, 0, 0];
    }
    return mul(value, (len - maxDelta) / len);
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t
    ];
}

function lerpNumber(a: number, b: number, t: number): number {
    const clampedT = clamp(t, 0, 1);
    return a + (b - a) * clampedT;
}

function degreesToRadians(degrees: number): number {
    return degrees * Math.PI / 180;
}

function radiansToDegrees(radians: number): number {
    return radians * 180 / Math.PI;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function add(a: Vec3, b: Vec3): Vec3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a: Vec3, b: Vec3): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function mul(v: Vec3, scalar: number): Vec3 {
    return [v[0] * scalar, v[1] * scalar, v[2] * scalar];
}

function dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

function length(v: Vec3): number {
    return Math.hypot(v[0], v[1], v[2]);
}

function distance(a: Vec3, b: Vec3): number {
    return length(sub(a, b));
}

function normalize(v: Vec3): Vec3 {
    const len = length(v);
    if (len === 0) {
        return [0, 0, 0];
    }
    return [v[0] / len, v[1] / len, v[2] / len];
}

function perpendicular(up: Vec3): Vec3 {
    const axis: Vec3 = Math.abs(up[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    return normalize(cross(up, axis));
}

function safePerpendicular(direction: Vec3, up: Vec3): Vec3 {
    const right = cross(direction, up);
    if (length(right) < 0.00001) {
        return perpendicular(up);
    }
    return normalize(right);
}

function rotateAroundAxis(v: Vec3, axis: Vec3, radians: number): Vec3 {
    const normalizedAxis = normalize(axis);
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const axisDot = dot(normalizedAxis, v);
    return add(
        add(mul(v, cos), mul(cross(normalizedAxis, v), sin)),
        mul(normalizedAxis, axisDot * (1 - cos))
    );
}
