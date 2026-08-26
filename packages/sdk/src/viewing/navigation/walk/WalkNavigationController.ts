import {SDKTask} from "../../../base/core";
import type {Vec3} from "../../../base/math/vector";
import {SceneRaycaster} from "../../../spatial/collision";
import type {View} from "../../viewer";
import type {ModelNavigationController} from "../model";
import type {WalkNavigationControllerParams} from "./WalkNavigationControllerParams";

const DEFAULT_EYE_HEIGHT = 1.7;
const DEFAULT_BODY_RADIUS = 0.28;
const DEFAULT_WALK_SPEED = 4;
const DEFAULT_RUN_SPEED = 8.5;
const DEFAULT_STEP_HEIGHT = 0.35;
const DEFAULT_MAX_FALL = 1.5;
const DEFAULT_FALL_ACCELERATION = 9.8;
const DEFAULT_MAX_FALL_SPEED = 30;
const DEFAULT_MAX_SLOPE_DEGREES = 50;
const DEFAULT_MOUSE_LOOK_DEGREES_PER_PIXEL = 0.12;
const DEFAULT_KEYBOARD_LOOK_DEGREES_PER_SECOND = 90;
const DEFAULT_MAX_PITCH_DEGREES = 85;
const MIN_LOOK_DISTANCE = 0.01;
const MAX_FRAME_SECONDS = 0.1;
const DOWN_RAY_CLEARANCE = 0.05;
const MIN_STEP_RISE = 0.01;

const FORWARD_KEYS = new Set(["KeyW", "w", "W"]);
const BACKWARD_KEYS = new Set(["KeyS", "s", "S"]);
const LEFT_KEYS = new Set(["KeyA", "a", "A"]);
const RIGHT_KEYS = new Set(["KeyD", "d", "D"]);
const LOOK_UP_KEYS = new Set(["ArrowUp"]);
const LOOK_DOWN_KEYS = new Set(["ArrowDown"]);
const LOOK_LEFT_KEYS = new Set(["ArrowLeft"]);
const LOOK_RIGHT_KEYS = new Set(["ArrowRight"]);
const RUN_KEYS = new Set(["ShiftLeft", "ShiftRight", "Shift"]);
const HANDLED_KEYS = new Set([
    ...FORWARD_KEYS,
    ...BACKWARD_KEYS,
    ...LEFT_KEYS,
    ...RIGHT_KEYS,
    ...LOOK_UP_KEYS,
    ...LOOK_DOWN_KEYS,
    ...LOOK_LEFT_KEYS,
    ...LOOK_RIGHT_KEYS,
    ...RUN_KEYS
]);

/**
 * Opt-in walking navigation for moving through building interiors.
 *
 * ``WalkNavigationController`` drives a camera like a standing person: WASD
 * moves on the horizontal plane, Shift runs, pointer drag and arrow keys look
 * around, and the controller uses Scene raycasts to follow floors and block
 * direct movement through walls.
 */
export class WalkNavigationController {

    /**
     * The View navigated by this controller.
     */
    readonly view: View;

    /**
     * Raycaster used for floor following and obstacle checks.
     */
    readonly raycaster: SceneRaycaster;

    #active = false;
    #destroyed = false;
    #keysDown = new Set<string>();
    #mouseOver = false;
    #looking = false;
    #pointerId: number | null = null;
    #lastPointerX = 0;
    #lastPointerY = 0;
    #lastTime = performance.now();
    #task: SDKTask;
    #viewElement: HTMLElement;
    #suspendModelNavigationController?: ModelNavigationController;
    #suspendedModelNavigationControllerActive: boolean | null = null;
    #unsubscribeViewDestroyed?: () => void;

    #eyeHeight: number;
    #bodyRadius: number;
    #walkSpeed: number;
    #runSpeed: number;
    #stepHeight: number;
    #maxFall: number;
    #fallAcceleration: number;
    #maxFallSpeed: number;
    #fallSpeed = 0;
    #walkableDot: number;
    #mouseLookRadiansPerPixel: number;
    #keyboardLookRadiansPerSecond: number;
    #maxPitchRadians: number;
    #keyboardEnabledOnlyOnMouseover: boolean;
    #collision: boolean;
    #gravity: boolean;
    #obstacleFilter?: (objectId: string) => boolean;
    #walkSurfaceFilter?: (objectId: string) => boolean;

    constructor(view: View, params: WalkNavigationControllerParams = {}) {
        this.view = view;
        this.raycaster = params.raycaster || new SceneRaycaster(view.viewer.scene);
        this.#viewElement = view.htmlElement;
        this.#suspendModelNavigationController = params.suspendModelNavigationController;
        this.#eyeHeight = params.eyeHeight ?? DEFAULT_EYE_HEIGHT;
        this.#bodyRadius = params.bodyRadius ?? DEFAULT_BODY_RADIUS;
        this.#walkSpeed = params.walkSpeed ?? DEFAULT_WALK_SPEED;
        this.#runSpeed = params.runSpeed ?? DEFAULT_RUN_SPEED;
        this.#stepHeight = params.stepHeight ?? DEFAULT_STEP_HEIGHT;
        this.#maxFall = params.maxFall ?? DEFAULT_MAX_FALL;
        this.#fallAcceleration = Math.max(0, params.fallAcceleration ?? DEFAULT_FALL_ACCELERATION);
        this.#maxFallSpeed = Math.max(0, params.maxFallSpeed ?? DEFAULT_MAX_FALL_SPEED);
        this.#walkableDot = Math.cos(degreesToRadians(params.maxSlopeDegrees ?? DEFAULT_MAX_SLOPE_DEGREES));
        this.#mouseLookRadiansPerPixel = degreesToRadians(params.mouseLookDegreesPerPixel ?? DEFAULT_MOUSE_LOOK_DEGREES_PER_PIXEL);
        this.#keyboardLookRadiansPerSecond = degreesToRadians(params.keyboardLookDegreesPerSecond ?? DEFAULT_KEYBOARD_LOOK_DEGREES_PER_SECOND);
        this.#maxPitchRadians = degreesToRadians(params.maxPitchDegrees ?? DEFAULT_MAX_PITCH_DEGREES);
        this.#keyboardEnabledOnlyOnMouseover = params.keyboardEnabledOnlyOnMouseover ?? true;
        this.#collision = params.collision ?? true;
        this.#gravity = params.gravity ?? true;
        this.#obstacleFilter = params.obstacleFilter;
        this.#walkSurfaceFilter = params.walkSurfaceFilter;

        this.#bindEvents();
        this.#task = new SDKTask({
            name: "WalkNavigationController",
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
     * Whether walk navigation is active.
     */
    set active(active: boolean) {
        if (this.#destroyed || active === this.#active) {
            return;
        }
        this.#active = active;
        this.#lastTime = performance.now();
        this.#keysDown.clear();
        this.#looking = false;
        this.#pointerId = null;
        this.#fallSpeed = 0;
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
     * Camera height above the walked surface, in world-space units.
     */
    set eyeHeight(eyeHeight: number) {
        this.#eyeHeight = Math.max(0.01, eyeHeight);
    }

    get eyeHeight(): number {
        return this.#eyeHeight;
    }

    /**
     * Approximate body radius used for horizontal obstacle checks.
     */
    set bodyRadius(bodyRadius: number) {
        this.#bodyRadius = Math.max(0, bodyRadius);
    }

    get bodyRadius(): number {
        return this.#bodyRadius;
    }

    /**
     * Normal walking speed, in world-space units per second.
     */
    set walkSpeed(walkSpeed: number) {
        this.#walkSpeed = Math.max(0, walkSpeed);
    }

    get walkSpeed(): number {
        return this.#walkSpeed;
    }

    /**
     * Running speed while Shift is held, in world-space units per second.
     */
    set runSpeed(runSpeed: number) {
        this.#runSpeed = Math.max(0, runSpeed);
    }

    get runSpeed(): number {
        return this.#runSpeed;
    }

    /**
     * Destroys this controller and restores any suspended ModelNavigationController.
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
        if (!this.#suspendModelNavigationController || this.#suspendedModelNavigationControllerActive !== null) {
            return;
        }
        this.#suspendedModelNavigationControllerActive = this.#suspendModelNavigationController.active;
        this.#suspendModelNavigationController.active = false;
    }

    #restoreDefaultController(): void {
        if (!this.#suspendModelNavigationController || this.#suspendedModelNavigationControllerActive === null) {
            return;
        }
        this.#suspendModelNavigationController.active = this.#suspendedModelNavigationControllerActive;
        this.#suspendedModelNavigationControllerActive = null;
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
        this.#looking = true;
        this.#pointerId = event.pointerId;
        this.#lastPointerX = event.clientX;
        this.#lastPointerY = event.clientY;
        this.#viewElement.setPointerCapture?.(event.pointerId);
        event.preventDefault();
    };

    #onPointerMove = (event: PointerEvent): void => {
        if (!this.#active || !this.#looking || event.pointerId !== this.#pointerId) {
            return;
        }
        const dx = event.movementX || event.clientX - this.#lastPointerX;
        const dy = event.movementY || event.clientY - this.#lastPointerY;
        this.#lastPointerX = event.clientX;
        this.#lastPointerY = event.clientY;
        this.#look(dx, dy);
        event.preventDefault();
    };

    #onPointerUp = (event: PointerEvent): void => {
        if (event.pointerId !== this.#pointerId) {
            return;
        }
        this.#looking = false;
        this.#pointerId = null;
        this.#viewElement.releasePointerCapture?.(event.pointerId);
    };

    #onKeyDown = (event: KeyboardEvent): void => {
        if (!this.#shouldHandleKeyEvent(event)) {
            return;
        }
        const code = keyCode(event);
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
        this.#looking = false;
        this.#pointerId = null;
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
        const lookYawAmount = pressed(this.#keysDown, LOOK_LEFT_KEYS) - pressed(this.#keysDown, LOOK_RIGHT_KEYS);
        const lookPitchAmount = pressed(this.#keysDown, LOOK_UP_KEYS) - pressed(this.#keysDown, LOOK_DOWN_KEYS);
        if (lookYawAmount !== 0 || lookPitchAmount !== 0) {
            this.#lookBy(
                lookYawAmount * this.#keyboardLookRadiansPerSecond * elapsedSeconds,
                lookPitchAmount * this.#keyboardLookRadiansPerSecond * elapsedSeconds,
                up
            );
        }

        const camera = this.view.camera;
        const basis = cameraBasis(camera.eye, camera.look, up);
        const forwardAmount = pressed(this.#keysDown, FORWARD_KEYS) - pressed(this.#keysDown, BACKWARD_KEYS);
        const rightAmount = pressed(this.#keysDown, RIGHT_KEYS) - pressed(this.#keysDown, LEFT_KEYS);
        const inputLength = Math.hypot(forwardAmount, rightAmount);
        const inputScale = inputLength > 1 ? 1 / inputLength : 1;
        const speed = pressed(this.#keysDown, RUN_KEYS) ? this.#runSpeed : this.#walkSpeed;
        const distance = speed * elapsedSeconds * inputScale;
        const move = inputLength === 0
            ? [0, 0, 0] as Vec3
            : add(
                mul(basis.flatForward, forwardAmount * distance),
                mul(basis.right, rightAmount * distance)
            );

        this.#move(move, basis.direction, up, elapsedSeconds);
    }

    #look(dx: number, dy: number): void {
        if (dx === 0 && dy === 0) {
            return;
        }
        const up = this.#worldUp();
        this.#lookBy(-dx * this.#mouseLookRadiansPerPixel, -dy * this.#mouseLookRadiansPerPixel, up);
    }

    #lookBy(yaw: number, pitchDelta: number, up: Vec3): void {
        if (yaw === 0 && pitchDelta === 0) {
            return;
        }
        const camera = this.view.camera;
        const basis = cameraBasis(camera.eye, camera.look, up);
        const pitch = clamp(basis.pitch + pitchDelta, -this.#maxPitchRadians, this.#maxPitchRadians);
        const flatForward = normalize(rotateAroundAxis(basis.flatForward, up, yaw));
        const direction = normalize(add(mul(flatForward, Math.cos(pitch)), mul(up, Math.sin(pitch))));
        const lookDistance = Math.max(distance(camera.eye, camera.look), MIN_LOOK_DISTANCE);

        camera.look = add(camera.eye, mul(direction, lookDistance));
        camera.up = up;
    }

    #move(move: Vec3, viewDirection: Vec3, up: Vec3, elapsedSeconds: number): void {
        const moveDistance = length(move);
        if (moveDistance === 0 && !this.#gravity) {
            return;
        }
        const camera = this.view.camera;
        const oldEye = [...camera.eye] as Vec3;
        const oldFoot = sub(oldEye, mul(up, this.#eyeHeight));

        let foot = moveDistance === 0 ? oldFoot : add(oldFoot, move);
        if (moveDistance > 0 && this.#collision && this.#isBlocked(oldFoot, move, moveDistance, up)) {
            if (!this.#gravity) {
                return;
            }
            const steppedFoot = this.#steppedFoot(oldFoot, move, moveDistance, up);
            if (steppedFoot) {
                foot = steppedFoot;
            } else {
                foot = oldFoot;
            }
        }

        if (this.#gravity) {
            foot = this.#groundedFoot(foot, up, elapsedSeconds);
        }

        const newEye = add(foot, mul(up, this.#eyeHeight));
        const lookDistance = Math.max(distance(camera.eye, camera.look), MIN_LOOK_DISTANCE);
        camera.eye = newEye;
        camera.look = add(newEye, mul(viewDirection, lookDistance));
        camera.up = up;
    }

    #isBlocked(foot: Vec3, move: Vec3, moveDistance: number, up: Vec3): boolean {
        const direction = normalize(move);
        const heights = [Math.max(this.#bodyRadius, 0.05), Math.max(this.#eyeHeight * 0.62, this.#bodyRadius)];
        const tMax = moveDistance + this.#bodyRadius;
        for (const height of heights) {
            const origin = add(foot, mul(up, height));
            const result = this.raycaster.pick({
                view: this.view,
                ray: {origin, dir: direction},
                tMin: 0,
                tMax,
                pickSurfaceNormal: true,
                filter: this.#obstacleFilter
            });
            if (result.ok && result.value.hit && !this.#isWalkableNormal(result.value.worldNormal, up)) {
                return true;
            }
        }
        return false;
    }

    #steppedFoot(oldFoot: Vec3, move: Vec3, moveDistance: number, up: Vec3): Vec3 | null {
        const direction = normalize(move);
        const probeDistances = [
            moveDistance + Math.max(this.#bodyRadius * 0.5, 0.05),
            moveDistance + this.#bodyRadius,
            moveDistance + this.#bodyRadius + this.#stepHeight * 0.5,
            moveDistance + this.#bodyRadius + this.#stepHeight
        ];
        for (const probeDistance of probeDistances) {
            const probeFoot = add(oldFoot, mul(direction, probeDistance));
            const stepSurface = this.#walkSurfaceAt(probeFoot, this.#stepHeight, up);
            if (!stepSurface) {
                continue;
            }
            const rise = dot(sub(stepSurface, oldFoot), up);
            if (rise >= MIN_STEP_RISE && rise <= this.#stepHeight) {
                return add(add(oldFoot, move), mul(up, rise));
            }
        }
        return null;
    }

    #groundedFoot(candidateFoot: Vec3, up: Vec3, elapsedSeconds: number): Vec3 {
        const nextFallSpeed = Math.min(this.#maxFallSpeed, this.#fallSpeed + this.#fallAcceleration * elapsedSeconds);
        const fallDistance = (this.#fallSpeed + nextFallSpeed) * 0.5 * elapsedSeconds;
        const surface = this.#walkSurfaceAt(candidateFoot, this.#stepHeight + Math.max(this.#maxFall, fallDistance), up);
        if (surface) {
            this.#fallSpeed = 0;
            return surface;
        }
        this.#fallSpeed = nextFallSpeed;
        return add(candidateFoot, mul(up, -fallDistance));
    }

    #walkSurfaceAt(candidateFoot: Vec3, verticalRange: number, up: Vec3): Vec3 | null {
        const rayOrigin = add(candidateFoot, mul(up, this.#stepHeight + DOWN_RAY_CLEARANCE));
        const rayDirection = mul(up, -1);
        const result = this.raycaster.pick({
            view: this.view,
            ray: {origin: rayOrigin, dir: rayDirection},
            tMin: 0,
            tMax: verticalRange + DOWN_RAY_CLEARANCE,
            pickSurfaceNormal: true,
            filter: this.#walkSurfaceFilter
        });
        if (result.ok && result.value.hit && result.value.worldPos && this.#isWalkableNormal(result.value.worldNormal, up)) {
            return [...result.value.worldPos] as Vec3;
        }
        return null;
    }

    #isWalkableNormal(normal: Vec3 | null | undefined, up: Vec3): boolean {
        if (!normal) {
            return false;
        }
        return Math.abs(dot(normalize(normal), up)) >= this.#walkableDot;
    }

    #worldUp(): Vec3 {
        return normalize(this.view.viewer.scene.coordinateSystem.worldUp);
    }
}

function cameraBasis(eye: Vec3, look: Vec3, up: Vec3): { direction: Vec3; flatForward: Vec3; right: Vec3; pitch: number } {
    const direction = normalize(sub(look, eye));
    let flatForward = sub(direction, mul(up, dot(direction, up)));
    if (length(flatForward) < 0.00001) {
        flatForward = perpendicular(up);
    } else {
        flatForward = normalize(flatForward);
    }
    const right = normalize(cross(flatForward, up));
    const pitch = Math.asin(clamp(dot(direction, up), -1, 1));
    return {direction, flatForward, right, pitch};
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

function degreesToRadians(degrees: number): number {
    return degrees * Math.PI / 180;
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

function rotateAroundAxis(v: Vec3, axis: Vec3, radians: number): Vec3 {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const axisDot = dot(axis, v);
    return add(
        add(mul(v, cos), mul(cross(axis, v), sin)),
        mul(axis, axisDot * (1 - cos))
    );
}
