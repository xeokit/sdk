import type {View} from "../../viewer";
import type {ModelNavigationController} from "../model";
import type {GlobeNavigationControllerParams} from "./GlobeNavigationControllerParams";

type Vec3 = [number, number, number];

interface GlobePointerState {
    id: number;
    x: number;
    y: number;
    lastMoveTime: number;
    lastInertiaTime: number;
    mode: GlobeNavigationMode;
    surface: Vec3 | null;
    surfaceLost: boolean;
    polarFallback: boolean;
}

type GlobeNavigationMode = "spin" | "orbitPoint";

interface LookTransition {
    startTime: number;
    duration: number;
    eye: Vec3;
    fromLook: Vec3;
    fromUp: Vec3;
    toLook: Vec3;
    toUp: Vec3;
}

const DEFAULT_CENTER: Vec3 = [0, 0, 0];
const DEFAULT_WORLD_UP: Vec3 = [0, 0, 1];

/**
 * Pointer-driven camera controller for virtual-globe navigation.
 *
 * ``GlobeNavigationController`` is intended for Earth-scale spherical models.
 * In its default spin mode, pointer drags grab the point on the globe under the
 * cursor and move the camera as if spinning the globe about its pole, with
 * constrained pole tilt and inertial coast. Modifier-click on a surface point
 * switches temporarily to orbit-about-point zoom/navigation; double-click eases
 * the camera to look at the picked point without zooming and, when a suspended
 * ModelNavigationController is configured,
 * restores that controller with the picked point as its pivot. Press ``Escape``
 * or ``C`` to return to center-spin mode while globe navigation remains active.
 */
export class GlobeNavigationController {

    /**
     * The View navigated by this controller.
     */
    readonly view: View;

    /**
     * Globe center in world-space coordinates.
     */
    readonly center: Vec3;

    /**
     * Globe radius in world-space units.
     */
    readonly radius: number;

    /**
     * Pole axis used for yaw and upright camera reconstruction.
     */
    readonly worldUp: Vec3;

    private _active: boolean;
    private _destroyed = false;
    private _suspendModelNavigationController?: ModelNavigationController;
    private _suspendedModelNavigationControllerActive: boolean | null = null;
    private _element: HTMLElement;
    private _minAltitude: number;
    private _maxAltitude: number;
    private _rotateSpeed: number;
    private _latitudinalDragScale: number;
    private _zoomSpeed: number;
    private _inertiaTime: number;
    private _zoomInertiaTime: number;
    private _maxInertiaSpeed: number;
    private _minInertiaPixels: number;
    private _releaseStillnessTime: number;
    private _releaseVelocityMaxAge: number;
    private _releaseEnergyRetention: number;
    private _doubleClickLookDuration: number;
    private _maxViewLatitude: number;
    private _polarDragDampingStart: number;
    private _polarDragFallbackStart: number;
    private _polarFallbackDragScale: number;
    private _orbitTarget: Vec3;
    private _mode: GlobeNavigationMode = "spin";
    private _pointer: GlobePointerState | null = null;
    private _spinVelocity: [number, number] = [0, 0];
    private _constrainedVelocity: [number, number] = [0, 0];
    private _zoomVelocity = 0;
    private _zoomTarget: Vec3 | null = null;
    private _lookTransition: LookTransition | null = null;
    private _animationFrame: number | null = null;
    private _lastFrameTime = 0;

    /**
     * Creates a globe navigation controller for the given View.
     *
     * When `params.active` is omitted or `true`, the controller immediately
     * attaches pointer, wheel and keyboard handlers. When
     * `params.suspendModelNavigationController` is supplied, that standard
     * ModelNavigationController is
     * deactivated while globe navigation is active and restored when globe
     * navigation is deactivated or destroyed.
     *
     * @param view View whose camera will be controlled.
     * @param params Globe navigation configuration.
     */
    constructor(view: View, params: GlobeNavigationControllerParams = {}) {
        this.view = view;
        this.center = toVec3(params.center || DEFAULT_CENTER);
        this.radius = params.radius ?? 6371000;
        this.worldUp = normalize(params.worldUp || DEFAULT_WORLD_UP);
        this._element = view.htmlElement;
        this._minAltitude = params.minAltitude ?? 1000;
        this._maxAltitude = params.maxAltitude ?? 150000000;
        this._rotateSpeed = params.rotateSpeed ?? 0.006;
        this._latitudinalDragScale = params.latitudinalDragScale ?? 0.55;
        this._zoomSpeed = params.zoomSpeed ?? 0.0015;
        this._inertiaTime = params.inertiaTime ?? 180;
        this._zoomInertiaTime = params.zoomInertiaTime ?? 130;
        this._maxInertiaSpeed = params.maxInertiaSpeed ?? 0.45;
        this._minInertiaPixels = params.minInertiaPixels ?? 4;
        this._releaseStillnessTime = params.releaseStillnessTime ?? 90;
        this._releaseVelocityMaxAge = params.releaseVelocityMaxAge ?? 55;
        this._releaseEnergyRetention = params.releaseEnergyRetention ?? 0.65;
        this._doubleClickLookDuration = params.doubleClickLookDuration ?? 450;
        this._maxViewLatitude = (params.maxViewLatitudeDegrees ?? 80) * Math.PI / 180;
        this._polarDragDampingStart = Math.sin((params.polarDragDampingStartDegrees ?? 55) * Math.PI / 180);
        this._polarDragFallbackStart = Math.sin((params.polarDragFallbackStartDegrees ?? 72) * Math.PI / 180);
        this._polarFallbackDragScale = params.polarFallbackDragScale ?? 0.35;
        this._orbitTarget = this.center.slice() as Vec3;
        this._suspendModelNavigationController = params.suspendModelNavigationController;
        this._active = params.active ?? true;

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onWheel = this._onWheel.bind(this);
        this._onDblClick = this._onDblClick.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
        this._step = this._step.bind(this);

        this._element.addEventListener("pointerdown", this._onPointerDown);
        window.addEventListener("pointermove", this._onPointerMove);
        window.addEventListener("pointerup", this._onPointerUp);
        this._element.addEventListener("wheel", this._onWheel, {passive: false});
        this._element.addEventListener("dblclick", this._onDblClick);
        window.addEventListener("keydown", this._onKeyDown);

        if (this._active) {
            this._suspendDefaultController();
        }
        this._applySpinCamera(toVec3(this.view.camera.eye));
    }

    /**
     * Whether this controller is currently handling input.
     *
     * Setting this to `false` stops pointer, wheel and keyboard handling,
     * clears pending drag/zoom inertia, and restores any suspended
     * ModelNavigationController. Setting
     * it to `true` resumes input handling and suspends the configured standard
     * controller again.
     */
    get active(): boolean {
        return this._active;
    }

    /**
     * Whether this controller is currently handling input.
     */
    set active(value: boolean) {
        if (this._active === value) {
            return;
        }
        this._active = value;
        if (value) {
            this._suspendDefaultController();
        } else {
            this._restoreDefaultController();
            this._pointer = null;
            this._spinVelocity = [0, 0];
            this._constrainedVelocity = [0, 0];
            this._zoomVelocity = 0;
            this._lookTransition = null;
        }
    }

    /**
     * Returns to globe-center spin mode.
     */
    spinAboutCenter(): void {
        this._mode = "spin";
        this._orbitTarget = this.center.slice() as Vec3;
        this._spinVelocity = [0, 0];
        this._constrainedVelocity = [0, 0];
        this._zoomVelocity = 0;
        this._lookTransition = null;
        this._applySpinCamera(toVec3(this.view.camera.eye));
    }

    /**
     * Switches to orbiting about a world-space point.
     */
    orbitAbout(point: number[]): void {
        this._mode = "orbitPoint";
        this._orbitTarget = toVec3(point);
        this._spinVelocity = [0, 0];
        this._constrainedVelocity = [0, 0];
        this._lookTransition = null;
        this._applyCamera(toVec3(this.view.camera.eye), this._orbitTarget, toVec3(this.view.camera.up));
    }

    /**
     * Destroys this controller and restores any suspended ModelNavigationController.
     */
    destroy(): void {
        if (this._destroyed) {
            return;
        }
        this._destroyed = true;
        if (this._animationFrame !== null) {
            cancelAnimationFrame(this._animationFrame);
            this._animationFrame = null;
        }
        this._element.removeEventListener("pointerdown", this._onPointerDown);
        window.removeEventListener("pointermove", this._onPointerMove);
        window.removeEventListener("pointerup", this._onPointerUp);
        this._element.removeEventListener("wheel", this._onWheel);
        this._element.removeEventListener("dblclick", this._onDblClick);
        window.removeEventListener("keydown", this._onKeyDown);
        this._restoreDefaultController();
    }

    private _onPointerDown(event: PointerEvent): void {
        if (!this._active || event.button !== 0) {
            return;
        }
        event.preventDefault();
        this._lookTransition = null;
        this._spinVelocity = [0, 0];
        this._constrainedVelocity = [0, 0];
        this._element.setPointerCapture?.(event.pointerId);
        const canvasPos = this._canvasPos(event);
        let surfacePoint: Vec3 | null = null;
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
            const hit = this._pickSphere(canvasPos);
            if (hit) {
                this.orbitAbout(hit);
            }
        } else if (this._mode === "spin") {
            surfacePoint = this._pickSphere(canvasPos);
        }
        const surfaceNormal = surfacePoint ? normalize(sub(surfacePoint, this.center)) : null;
        this._pointer = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            lastMoveTime: performance.now(),
            lastInertiaTime: 0,
            mode: this._mode,
            surface: surfaceNormal,
            surfaceLost: false,
            polarFallback: surfaceNormal ? Math.abs(dot(surfaceNormal, this.worldUp)) >= this._polarDragFallbackStart : false
        };
    }

    private _onPointerMove(event: PointerEvent): void {
        if (!this._active || !this._pointer || event.pointerId !== this._pointer.id) {
            return;
        }
        event.preventDefault();
        const dx = event.clientX - this._pointer.x;
        const dy = event.clientY - this._pointer.y;
        const now = performance.now();
        const dt = Math.max(1, now - this._pointer.lastMoveTime);
        this._pointer.x = event.clientX;
        this._pointer.y = event.clientY;
        this._pointer.lastMoveTime = now;
        if (dx === 0 && dy === 0) {
            return;
        }
        const vx = clamp(dx / dt, -this._maxInertiaSpeed, this._maxInertiaSpeed);
        const vy = clamp(dy / dt, -this._maxInertiaSpeed, this._maxInertiaSpeed);
        this._spinVelocity[0] = this._spinVelocity[0] * 0.75 + vx * 0.25;
        this._spinVelocity[1] = this._spinVelocity[1] * 0.75 + vy * 0.25;
        const screenDistance = Math.hypot(dx, dy);
        if (screenDistance >= this._minInertiaPixels) {
            this._pointer.lastInertiaTime = now;
        }
        if ((this._pointer.polarFallback || this._pointer.surfaceLost) && this._pointer.mode === "spin") {
            this._applyDampedScreenDrag(dx, dy, dt, screenDistance);
            this._spinVelocity = [0, 0];
            return;
        }
        if (this._pointer.surface && !this._pointer.surfaceLost && this._pointer.mode === "spin" && this._dragSurfaceToPointer(this._canvasPos(event), dt, screenDistance)) {
            this._spinVelocity = [0, 0];
            return;
        }
        this._constrainedVelocity = [0, 0];
        if (this._pointer.mode === "spin") {
            this._rotateConstrained(-dx * this._rotateSpeed, -dy * this._rotateSpeed * this._latitudinalDragScale);
        } else {
            this._orbit(dx, dy, this._orbitTarget);
        }
    }

    private _onPointerUp(event: PointerEvent): void {
        if (!this._active || !this._pointer || event.pointerId !== this._pointer.id) {
            return;
        }
        this._element.releasePointerCapture?.(event.pointerId);
        const releaseAge = performance.now() - this._pointer.lastMoveTime;
        const inertiaAge = this._pointer.lastInertiaTime ? performance.now() - this._pointer.lastInertiaTime : Infinity;
        if (releaseAge > this._releaseStillnessTime || inertiaAge > this._releaseVelocityMaxAge) {
            this._spinVelocity = [0, 0];
            this._constrainedVelocity = [0, 0];
            this._lookTransition = null;
        } else {
            this._spinVelocity[0] *= this._releaseEnergyRetention;
            this._spinVelocity[1] *= this._releaseEnergyRetention;
            this._constrainedVelocity[0] *= this._releaseEnergyRetention;
            this._constrainedVelocity[1] *= this._releaseEnergyRetention;
        }
        this._pointer = null;
        this._requestStep();
    }

    private _onWheel(event: WheelEvent): void {
        if (!this._active) {
            return;
        }
        event.preventDefault();
        this._lookTransition = null;
        const wantsPointZoom = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
        const hit = wantsPointZoom ? this._pickSphere(this._canvasPos(event)) : null;
        const target = hit || (this._mode === "spin" ? this.center : this._orbitTarget);
        if (wantsPointZoom && hit) {
            this._mode = "orbitPoint";
            this._orbitTarget = hit.slice() as Vec3;
        }
        this._zoomTarget = target.slice() as Vec3;
        this._zoomVelocity += clamp(event.deltaY, -1200, 1200) * 0.0025;
        this._zoomVelocity = clamp(this._zoomVelocity, -6, 6);
        this._requestStep();
    }

    private _onDblClick(event: MouseEvent): void {
        if (!this._active) {
            return;
        }
        event.preventDefault();
        const hit = this._pickSphere(this._canvasPos(event));
        if (hit) {
            this._spinVelocity = [0, 0];
            this._constrainedVelocity = [0, 0];
            this._zoomVelocity = 0;
            this._zoomTarget = null;
            this._startLookTransition(hit);
        }
    }

    private _onKeyDown(event: KeyboardEvent): void {
        if (!this._active) {
            return;
        }
        if (event.key === "Escape" || event.key.toLowerCase() === "c") {
            this._lookTransition = null;
            this.spinAboutCenter();
        }
    }

    private _requestStep(): void {
        if (this._animationFrame !== null) {
            return;
        }
        this._lastFrameTime = performance.now();
        this._animationFrame = requestAnimationFrame(this._step);
    }

    private _step(time: number): void {
        this._animationFrame = null;
        const dt = clamp(time - this._lastFrameTime, 1, 50);
        this._lastFrameTime = time;

        this._updateLookTransition(time);

        if (!this._pointer) {
            const speed = Math.hypot(this._spinVelocity[0], this._spinVelocity[1]);
            const constrainedSpeed = Math.hypot(this._constrainedVelocity[0], this._constrainedVelocity[1]);
            if (constrainedSpeed > 0.000002) {
                const requestedPitch = this._constrainedVelocity[1] * dt;
                const applied = this._rotateConstrained(this._constrainedVelocity[0] * dt, requestedPitch);
                const decay = Math.exp(-dt / this._inertiaTime);
                this._constrainedVelocity[0] *= decay;
                this._constrainedVelocity[1] = Math.abs(applied.pitch - requestedPitch) > 1e-7 ? 0 : this._constrainedVelocity[1] * decay;
            } else {
                this._constrainedVelocity = [0, 0];
            }

            if (speed > 0.002) {
                const target = this._mode === "spin" ? this.center : this._orbitTarget;
                this._orbit(this._spinVelocity[0] * dt, this._spinVelocity[1] * dt, target);
                const decay = Math.exp(-dt / this._inertiaTime);
                this._spinVelocity[0] *= decay;
                this._spinVelocity[1] *= decay;
            } else {
                this._spinVelocity = [0, 0];
            }
        }

        if (Math.abs(this._zoomVelocity) > 0.002 && this._zoomTarget) {
            this._zoomTo(this._zoomTarget, this._zoomVelocity * dt);
            this._zoomVelocity *= Math.exp(-dt / this._zoomInertiaTime);
        } else {
            this._zoomVelocity = 0;
        }

        if (this._lookTransition || Math.hypot(this._spinVelocity[0], this._spinVelocity[1]) > 0.002 || Math.hypot(this._constrainedVelocity[0], this._constrainedVelocity[1]) > 0.000002 || Math.abs(this._zoomVelocity) > 0.002) {
            this._requestStep();
        }
    }

    private _startLookTransition(hit: Vec3): void {
        const eye = toVec3(this.view.camera.eye);
        const fromLook = toVec3(this.view.camera.look);
        const fromUp = toVec3(this.view.camera.up);
        const toLook = hit.slice() as Vec3;
        const toUp = projectUp(this.worldUp, normalize(sub(toLook, eye))) || fromUp;
        this._mode = "orbitPoint";
        this._orbitTarget = toLook.slice() as Vec3;
        this._lookTransition = {
            startTime: performance.now(),
            duration: Math.max(1, this._doubleClickLookDuration),
            eye,
            fromLook,
            fromUp,
            toLook,
            toUp
        };
        this._requestStep();
    }

    private _updateLookTransition(time: number): void {
        const transition = this._lookTransition;
        if (!transition) {
            return;
        }
        const t = clamp((time - transition.startTime) / transition.duration, 0, 1);
        const eased = easeInOutCubic(t);
        const look = lerpVec3(transition.fromLook, transition.toLook, eased);
        const up = normalize(lerpVec3(transition.fromUp, transition.toUp, eased));
        this._applyCamera(transition.eye, look, up);
        if (t >= 1) {
            this._lookTransition = null;
            this._applyCamera(transition.eye, transition.toLook, transition.toUp);
            if (this._suspendModelNavigationController) {
                this._suspendModelNavigationController.pivotPos = transition.toLook;
                this.active = false;
            }
        }
    }

    private _dragSurfaceToPointer(canvasPos: [number, number], dt: number, screenDistance: number): boolean {
        const hit = this._pickSphere(canvasPos);
        if (!hit) {
            if (this._pointer) {
                this._pointer.surfaceLost = true;
            }
            return false;
        }
        const fromSurface = normalize(sub(hit, this.center));
        if (Math.abs(dot(fromSurface, this.worldUp)) >= this._polarDragFallbackStart) {
            if (this._pointer) {
                this._pointer.surfaceLost = true;
            }
            return false;
        }
        const toSurface = this._pointer?.surface;
        if (!toSurface) {
            return false;
        }
        const motion = this._solveConstrainedSurfaceMotion(fromSurface, toSurface);
        if (!motion) {
            return true;
        }
        const applied = this._rotateConstrained(motion.yaw, motion.pitch);
        if (screenDistance >= this._minInertiaPixels && this._pointer) {
            this._constrainedVelocity[0] = this._constrainedVelocity[0] * 0.75 + clamp(applied.yaw / dt, -0.004, 0.004) * 0.25;
            this._constrainedVelocity[1] = this._constrainedVelocity[1] * 0.85 + clamp(applied.pitch / dt, -0.0022, 0.0022) * 0.15;
            this._pointer.lastInertiaTime = performance.now();
        }
        return true;
    }

    private _applyDampedScreenDrag(dx: number, dy: number, dt: number, screenDistance: number): void {
        const yaw = -dx * this._rotateSpeed * this._polarFallbackDragScale;
        const pitch = -dy * this._rotateSpeed * this._polarFallbackDragScale * this._latitudinalDragScale;
        const applied = this._rotateConstrained(yaw, pitch);
        if (screenDistance >= this._minInertiaPixels && this._pointer) {
            this._constrainedVelocity[0] = this._constrainedVelocity[0] * 0.75 + clamp(applied.yaw / dt, -0.0015, 0.0015) * 0.25;
            this._constrainedVelocity[1] = this._constrainedVelocity[1] * 0.85 + clamp(applied.pitch / dt, -0.0008, 0.0008) * 0.15;
            this._pointer.lastInertiaTime = performance.now();
        }
    }

    private _solveConstrainedSurfaceMotion(fromSurface: Vec3, toSurface: Vec3): { yaw: number; pitch: number } | null {
        const forward = normalize(sub(this.center, toVec3(this.view.camera.eye)));
        const viewUp = this._spinUpForEye(toVec3(this.view.camera.eye));
        const right = normalize(cross(forward, viewUp));
        const yawBasis = cross(this.worldUp, fromSurface);
        const pitchBasis = cross(right, fromSurface);
        const delta = sub(toSurface, fromSurface);
        const aa = dot(yawBasis, yawBasis);
        const ab = dot(yawBasis, pitchBasis);
        const bb = dot(pitchBasis, pitchBasis);
        const ad = dot(yawBasis, delta);
        const bd = dot(pitchBasis, delta);
        const determinant = aa * bb - ab * ab;
        if (Math.abs(determinant) < 1e-10) {
            return null;
        }
        const poleAmount = clamp((Math.abs(dot(fromSurface, this.worldUp)) - this._polarDragDampingStart) / (1 - this._polarDragDampingStart), 0, 1);
        const damping = 1 - poleAmount * poleAmount * 0.75;
        return {
            yaw: clamp((ad * bb - bd * ab) / determinant, -0.25, 0.25) * damping,
            pitch: clamp((aa * bd - ab * ad) / determinant, -0.25, 0.25) * damping * this._latitudinalDragScale
        };
    }

    private _rotateConstrained(yaw: number, pitch: number): { yaw: number; pitch: number } {
        let eyeOffset = sub(toVec3(this.view.camera.eye), this.center);
        let up = this._spinUpForEye(toVec3(this.view.camera.eye));
        let appliedPitch = 0;
        if (Math.abs(yaw) > 1e-10) {
            eyeOffset = rotateAroundAxis(eyeOffset, this.worldUp, yaw);
            up = rotateAroundAxis(up, this.worldUp, yaw);
        }
        if (Math.abs(pitch) > 1e-10) {
            const forward = normalize(mul(eyeOffset, -1));
            const right = normalize(cross(forward, up));
            appliedPitch = this._clampPitchToLatitude(eyeOffset, right, pitch);
            if (Math.abs(appliedPitch) > 1e-10) {
                eyeOffset = rotateAroundAxis(eyeOffset, right, appliedPitch);
            }
        }
        this._applySpinCamera(add(this.center, eyeOffset));
        return {yaw, pitch: appliedPitch};
    }

    private _applySpinCamera(eye: Vec3): void {
        const up = this._spinUpForEye(eye);
        this._applyCamera(eye, this.center, up);
    }

    private _spinUpForEye(eye: Vec3): Vec3 {
        const forward = normalize(sub(this.center, eye));
        return projectUp(this.worldUp, forward) || projectUp(toVec3(this.view.camera.up), forward) || perpendicular(forward);
    }

    private _clampPitchToLatitude(eyeOffset: Vec3, right: Vec3, pitch: number): number {
        const maxSin = Math.sin(this._maxViewLatitude);
        const proposed = normalize(rotateAroundAxis(eyeOffset, right, pitch));
        if (Math.abs(dot(proposed, this.worldUp)) <= maxSin) {
            return pitch;
        }

        let low = 0;
        let high = pitch;
        for (let i = 0; i < 24; i++) {
            const mid = (low + high) * 0.5;
            const candidate = normalize(rotateAroundAxis(eyeOffset, right, mid));
            if (Math.abs(dot(candidate, this.worldUp)) <= maxSin) {
                low = mid;
            } else {
                high = mid;
            }
        }
        return Math.abs(low) < 1e-8 ? 0 : low;
    }

    private _orbit(dx: number, dy: number, target: Vec3): void {
        let eyeOffset = sub(toVec3(this.view.camera.eye), target);
        let up = normalize(toVec3(this.view.camera.up));
        const yaw = -dx * this._rotateSpeed;
        eyeOffset = rotateAroundAxis(eyeOffset, this.worldUp, yaw);
        up = rotateAroundAxis(up, this.worldUp, yaw);

        const forward = normalize(sub(target, add(target, eyeOffset)));
        const right = normalize(cross(forward, up));
        const pitch = -dy * this._rotateSpeed;
        const pitchedOffset = rotateAroundAxis(eyeOffset, right, pitch);
        const pitchedUp = rotateAroundAxis(up, right, pitch);
        const newEye = add(target, pitchedOffset);
        this._applyCamera(newEye, target, pitchedUp);
    }

    private _zoomTo(target: Vec3, deltaY: number): void {
        const eye = toVec3(this.view.camera.eye);
        const toEye = sub(eye, target);
        const dist = length(toEye);
        const direction = dist > 0 ? mul(toEye, 1 / dist) : normalize(sub(eye, this.center));
        const scale = Math.exp(deltaY * this._zoomSpeed);
        const minDist = Math.max(this._minAltitude, 1);
        const nextDist = clamp(dist * scale, minDist, this._maxAltitude);
        const nextEye = add(target, mul(direction, nextDist));
        this._applyCamera(nextEye, target, toVec3(this.view.camera.up));
    }

    private _applyCamera(eye: Vec3, look: Vec3, requestedUp: Vec3): void {
        const forward = normalize(sub(look, eye));
        let up = projectUp(requestedUp, forward);
        if (!up) {
            up = projectUp(this.worldUp, forward) || perpendicular(forward);
        }
        this.view.camera.eye = eye;
        this.view.camera.look = look;
        this.view.camera.up = up;
        this._updateClipPlanes();
    }

    private _updateClipPlanes(): void {
        const altitude = Math.max(0, length(sub(toVec3(this.view.camera.eye), this.center)) - this.radius);
        this.view.camera.perspectiveProjection.near = clamp(altitude * 0.002, 10, 50000);
        this.view.camera.perspectiveProjection.far = Math.max(150000000, altitude + this.radius * 4);
    }

    private _canvasPos(event: MouseEvent | PointerEvent | WheelEvent): [number, number] {
        const rect = this._element.getBoundingClientRect();
        return [event.clientX - rect.left, event.clientY - rect.top];
    }

    private _pickSphere(canvasPos: [number, number]): Vec3 | null {
        const ray = this._rayFromCanvas(canvasPos);
        if (!ray) {
            return null;
        }
        return intersectSphere(ray.origin, ray.direction, this.center, this.radius);
    }

    private _rayFromCanvas(canvasPos: [number, number]): { origin: Vec3; direction: Vec3 } | null {
        const rect = this._element.getBoundingClientRect();
        const width = Math.max(1, rect.width);
        const height = Math.max(1, rect.height);
        const x = (canvasPos[0] / width) * 2 - 1;
        const y = 1 - (canvasPos[1] / height) * 2;
        const camera = this.view.camera;
        const eye = toVec3(camera.eye);
        const forward = normalize(sub(toVec3(camera.look), toVec3(camera.eye)));
        const right = normalize(cross(forward, toVec3(camera.up)));
        const up = normalize(cross(right, forward));
        const fov = (camera.perspectiveProjection.fov || 35) * Math.PI / 180;
        const tan = Math.tan(fov / 2);
        const aspect = width / height;
        const direction = normalize(add(add(forward, mul(right, x * aspect * tan)), mul(up, y * tan)));
        return {origin: eye, direction};
    }

    private _suspendDefaultController(): void {
        if (!this._suspendModelNavigationController || this._suspendedModelNavigationControllerActive !== null) {
            return;
        }
        this._suspendedModelNavigationControllerActive = this._suspendModelNavigationController.active;
        this._suspendModelNavigationController.active = false;
    }

    private _restoreDefaultController(): void {
        if (!this._suspendModelNavigationController || this._suspendedModelNavigationControllerActive === null) {
            return;
        }
        this._suspendModelNavigationController.active = this._suspendedModelNavigationControllerActive;
        this._suspendedModelNavigationControllerActive = null;
    }
}

function intersectSphere(origin: Vec3, direction: Vec3, center: Vec3, radius: number): Vec3 | null {
    const oc = sub(origin, center);
    const b = 2 * dot(oc, direction);
    const c = dot(oc, oc) - radius * radius;
    const discriminant = b * b - 4 * c;
    if (discriminant < 0) {
        return null;
    }
    const root = Math.sqrt(discriminant);
    const t0 = (-b - root) / 2;
    const t1 = (-b + root) / 2;
    const t = t0 > 0 ? t0 : t1 > 0 ? t1 : null;
    return t === null ? null : add(origin, mul(direction, t));
}

function projectUp(up: Vec3, forward: Vec3): Vec3 | null {
    const n = normalize(up);
    const projected = sub(n, mul(forward, dot(n, forward)));
    const len = length(projected);
    return len > 1e-8 ? mul(projected, 1 / len) : null;
}

function perpendicular(v: Vec3): Vec3 {
    const axis: Vec3 = Math.abs(v[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
    return normalize(cross(axis, v));
}

function rotateAroundAxis(v: Vec3, axis: Vec3, angle: number): Vec3 {
    const u = normalize(axis);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return add(add(mul(v, cos), mul(cross(u, v), sin)), mul(u, dot(u, v) * (1 - cos)));
}

function toVec3(v: ArrayLike<number>): Vec3 {
    return [v[0], v[1], v[2]];
}

function add(a: Vec3, b: Vec3): Vec3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a: Vec3, b: Vec3): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function mul(v: Vec3, s: number): Vec3 {
    return [v[0] * s, v[1] * s, v[2] * s];
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

function normalize(v: ArrayLike<number>): Vec3 {
    const len = Math.hypot(v[0], v[1], v[2]);
    return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 0];
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t
    ];
}

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
