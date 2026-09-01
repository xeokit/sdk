import {VehicleNavigationController} from "../VehicleNavigationController";

type Listener = (event: any) => void;

class FakeEventTarget {
    #listeners = new Map<string, Set<Listener>>();

    addEventListener(type: string, listener: Listener): void {
        let listeners = this.#listeners.get(type);
        if (!listeners) {
            listeners = new Set();
            this.#listeners.set(type, listeners);
        }
        listeners.add(listener);
    }

    removeEventListener(type: string, listener: Listener): void {
        this.#listeners.get(type)?.delete(listener);
    }

    dispatchEvent(event: any): boolean {
        event.target ??= this;
        for (const listener of Array.from(this.#listeners.get(event.type) || [])) {
            listener(event);
        }
        return true;
    }
}

class FakeHTMLElement extends FakeEventTarget {
    tagName = "div";
    isContentEditable = false;
    setPointerCapture(): void {}
    releasePointerCapture(): void {}
    getBoundingClientRect(): DOMRect {
        return {
            left: 0,
            top: 0,
            width: 200,
            height: 100,
            right: 200,
            bottom: 100,
            x: 0,
            y: 0,
            toJSON: () => ({})
        } as DOMRect;
    }
}

function makeView() {
    return {
        htmlElement: new FakeHTMLElement(),
        camera: {
            eye: [0, 0, 1.45],
            look: [1, 0, 1.45],
            up: [0, 0, 1]
        },
        viewer: {
            scene: {
                coordinateSystem: {
                    worldUp: [0, 0, 1]
                }
            },
            events: {
                onViewDestroyed: {
                    subscribe: jest.fn(() => jest.fn())
                }
            }
        }
    } as any;
}

function makeMissRaycaster() {
    return {
        pick: jest.fn(() => ({
            ok: true,
            value: {
                hit: false,
                objectId: null,
                meshId: null,
                worldPos: null,
                worldNormal: null,
                tHit: null,
                triangleIndex: -1,
                rayOrigin: [0, 0, 0],
                rayDir: [0, 0, -1]
            }
        }))
    };
}

function makeFlatSurfaceRaycaster(surfaceZ = 0) {
    return {
        pick: jest.fn(({ray, tMax}: any) => {
            if (ray.dir[2] >= 0) {
                return missPick(ray);
            }
            const t = (ray.origin[2] - surfaceZ) / -ray.dir[2];
            if (t < 0 || t > tMax) {
                return missPick(ray);
            }
            return {
                ok: true,
                value: {
                    hit: true,
                    objectId: "drive-surface",
                    meshId: "drive-surface.mesh",
                    worldPos: [ray.origin[0], ray.origin[1], surfaceZ],
                    worldNormal: [0, 0, 1],
                    tHit: t,
                    triangleIndex: 0,
                    rayOrigin: ray.origin,
                    rayDir: ray.dir
                }
            };
        })
    };
}

function makeSideObstacleRaycaster(minSideOffset = 0.75) {
    return {
        pick: jest.fn(({ray}: any) => {
            if (Math.abs(ray.origin[1]) < minSideOffset) {
                return missPick(ray);
            }
            return {
                ok: true,
                value: {
                    hit: true,
                    objectId: "side-obstacle",
                    meshId: "side-obstacle.mesh",
                    worldPos: [1, ray.origin[1], ray.origin[2]],
                    worldNormal: [0, 1, 0],
                    tHit: 1,
                    triangleIndex: 0,
                    rayOrigin: ray.origin,
                    rayDir: ray.dir
                }
            };
        })
    };
}

function makeSlopedSurfaceRaycaster(slopeX: number) {
    const normalLength = Math.hypot(slopeX, 1);
    const normal = [-slopeX / normalLength, 0, 1 / normalLength];
    return {
        pick: jest.fn(({ray, tMax}: any) => {
            if (ray.dir[2] >= 0) {
                return missPick(ray);
            }
            const surfaceZ = slopeX * ray.origin[0];
            const t = ray.origin[2] - surfaceZ;
            if (t < 0 || t > tMax) {
                return missPick(ray);
            }
            return {
                ok: true,
                value: {
                    hit: true,
                    objectId: "sloped-drive-surface",
                    meshId: "sloped-drive-surface.mesh",
                    worldPos: [ray.origin[0], ray.origin[1], surfaceZ],
                    worldNormal: normal,
                    tHit: t,
                    triangleIndex: 0,
                    rayOrigin: ray.origin,
                    rayDir: ray.dir
                }
            };
        })
    };
}

function missPick(ray: any) {
    return {
        ok: true,
        value: {
            hit: false,
            objectId: null,
            meshId: null,
            worldPos: null,
            worldNormal: null,
            tHit: null,
            triangleIndex: -1,
            rayOrigin: ray.origin,
            rayDir: ray.dir
        }
    };
}

function press(code: string, key = code) {
    dispatchKey("keydown", code, key);
}

function release(code: string, key = code) {
    dispatchKey("keyup", code, key);
}

function dispatchKey(type: string, code: string, key: string) {
    document.dispatchEvent({
        type,
        code,
        key,
        preventDefault: jest.fn()
    } as any);
}

function movePointer(element: FakeHTMLElement, clientX: number, clientY: number) {
    element.dispatchEvent({
        type: "pointermove",
        pointerId: 1,
        clientX,
        clientY,
        preventDefault: jest.fn()
    });
}

function pointerDown(element: FakeHTMLElement, clientX: number, clientY: number) {
    element.dispatchEvent({
        type: "pointerdown",
        pointerId: 1,
        button: 0,
        clientX,
        clientY,
        preventDefault: jest.fn()
    });
}

function dragPointer(element: FakeHTMLElement, clientX: number, clientY: number, movementX: number, movementY: number) {
    element.dispatchEvent({
        type: "pointermove",
        pointerId: 1,
        clientX,
        clientY,
        movementX,
        movementY,
        preventDefault: jest.fn()
    });
}

function pointerUp(element: FakeHTMLElement, clientX: number, clientY: number) {
    element.dispatchEvent({
        type: "pointerup",
        pointerId: 1,
        clientX,
        clientY,
        preventDefault: jest.fn()
    });
}

describe("VehicleNavigationController", () => {
    let now = 0;
    let nowSpy: jest.SpyInstance<number, []>;
    let originalDocument: Document | undefined;
    let originalWindow: Window & typeof globalThis | undefined;
    let originalHTMLElement: typeof HTMLElement | undefined;

    beforeEach(() => {
        jest.useFakeTimers();
        now = 0;
        nowSpy = jest.spyOn(performance, "now").mockImplementation(() => now);
        originalDocument = (globalThis as any).document;
        originalWindow = (globalThis as any).window;
        originalHTMLElement = (globalThis as any).HTMLElement;
        (globalThis as any).document = new FakeEventTarget();
        (globalThis as any).window = new FakeEventTarget();
        (globalThis as any).HTMLElement = FakeHTMLElement;
    });

    afterEach(() => {
        if (originalDocument) {
            (globalThis as any).document = originalDocument;
        } else {
            delete (globalThis as any).document;
        }
        if (originalWindow) {
            (globalThis as any).window = originalWindow;
        } else {
            delete (globalThis as any).window;
        }
        if (originalHTMLElement) {
            (globalThis as any).HTMLElement = originalHTMLElement;
        } else {
            delete (globalThis as any).HTMLElement;
        }
        nowSpy.mockRestore();
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it("uses vehicle navigation defaults", () => {
        const view = makeView();
        const controller = new VehicleNavigationController(view, {
            active: false,
            raycaster: makeMissRaycaster() as any
        });

        expect(controller.speed).toBe(0);
        expect(controller.maxForwardSpeed).toBe(22);
        expect(controller.maxReverseSpeed).toBe(5);
        expect(controller.cameraHeight).toBe(1.45);
        expect(controller.leanDegrees).toBe(18);
        controller.destroy();
        jest.advanceTimersByTime(20);
    });

    it("accelerates and ignores hover pointer movement", () => {
        const view = makeView();
        const controller = new VehicleNavigationController(view, {
            active: true,
            raycaster: makeMissRaycaster() as any,
            keyboardEnabledOnlyOnMouseover: false,
            collision: false,
            gravity: false,
            maxForwardSpeed: 10,
            acceleration: 20,
            coastDeceleration: 0,
            turnRateDegreesPerSecond: 90,
            leanDegrees: 20,
            cameraHeight: 1.45
        });

        movePointer(view.htmlElement, 200, 50);
        press("KeyW", "w");
        now = 100;
        jest.advanceTimersByTime(20);

        expect(controller.speed).toBeGreaterThan(0);
        expect(view.camera.eye[0]).toBeGreaterThan(0);
        expect(Math.abs(view.camera.eye[1])).toBeLessThan(0.000001);
        expect(Math.abs(view.camera.up[1])).toBeLessThan(0.000001);

        release("KeyW", "w");
        controller.destroy();
        jest.advanceTimersByTime(20);
    });

    it("turns and pitches from captured mouse drag", () => {
        const view = makeView();
        const controller = new VehicleNavigationController(view, {
            active: true,
            raycaster: makeMissRaycaster() as any,
            keyboardEnabledOnlyOnMouseover: false,
            collision: false,
            gravity: false,
            maxForwardSpeed: 10,
            coastDeceleration: 0,
            turnRateDegreesPerSecond: 90,
            flightPitchRateDegreesPerSecond: 90,
            mouseDragYawSensitivity: 0.02,
            mouseDragPitchSensitivity: 0.02,
            mouseDragResponse: 0,
            maxMouseDragInputPerFrame: 1,
            leanDegrees: 20,
            cameraHeight: 1.45
        });

        controller.speed = 10;
        pointerDown(view.htmlElement, 100, 50);
        dragPointer(view.htmlElement, 180, 30, 80, -20);
        now = 100;
        jest.advanceTimersByTime(20);

        expect(view.camera.eye[1]).toBeLessThan(0);
        expect(view.camera.look[2] - view.camera.eye[2]).toBeGreaterThan(0);
        expect(view.camera.up[1]).toBeLessThan(0);

        pointerUp(view.htmlElement, 180, 30);
        controller.destroy();
        jest.advanceTimersByTime(20);
    });

    it("continues turning while captured mouse drag is held", () => {
        const view = makeView();
        const controller = new VehicleNavigationController(view, {
            active: true,
            raycaster: makeMissRaycaster() as any,
            keyboardEnabledOnlyOnMouseover: false,
            collision: false,
            gravity: false,
            maxForwardSpeed: 100,
            coastDeceleration: 0,
            turnRateDegreesPerSecond: 90,
            mouseDragYawSensitivity: 0.02,
            mouseDragPitchSensitivity: 0.02,
            mouseDragResponse: 0,
            maxMouseDragInputPerFrame: 1,
            cameraHeight: 1.45
        });

        controller.speed = 0.5;
        pointerDown(view.htmlElement, 100, 50);
        dragPointer(view.htmlElement, 180, 50, 80, 0);
        now = 100;
        jest.advanceTimersByTime(20);
        const firstDirectionY = view.camera.look[1] - view.camera.eye[1];

        now = 200;
        jest.advanceTimersByTime(20);
        const heldDirectionY = view.camera.look[1] - view.camera.eye[1];

        expect(firstDirectionY).toBeLessThan(-0.01);
        expect(heldDirectionY).toBeLessThan(firstDirectionY - 0.01);

        pointerUp(view.htmlElement, 180, 50);
        controller.destroy();
        jest.advanceTimersByTime(20);
    });

    it("ramps keyboard steering from initial turn rate", () => {
        const view = makeView();
        const controller = new VehicleNavigationController(view, {
            active: true,
            raycaster: makeMissRaycaster() as any,
            keyboardEnabledOnlyOnMouseover: false,
            collision: false,
            gravity: false,
            maxForwardSpeed: 10,
            coastDeceleration: 0,
            turnRateDegreesPerSecond: 90,
            keySteerInitialScale: 0.2,
            keySteerRampSeconds: 1,
            cameraHeight: 1.45
        });

        controller.speed = 10;
        press("ArrowRight", "ArrowRight");
        now = 100;
        jest.advanceTimersByTime(20);
        const firstDirectionY = view.camera.look[1] - view.camera.eye[1];

        now = 1100;
        jest.advanceTimersByTime(20);
        const laterDirectionY = view.camera.look[1] - view.camera.eye[1];

        expect(firstDirectionY).toBeLessThan(0);
        expect(Math.abs(laterDirectionY)).toBeGreaterThan(Math.abs(firstDirectionY) + 0.01);

        release("ArrowRight", "ArrowRight");
        controller.destroy();
        jest.advanceTimersByTime(20);
    });

    it("keeps keyboard steering responsive at low speed", () => {
        const view = makeView();
        const controller = new VehicleNavigationController(view, {
            active: true,
            raycaster: makeMissRaycaster() as any,
            keyboardEnabledOnlyOnMouseover: false,
            collision: false,
            gravity: false,
            maxForwardSpeed: 100,
            coastDeceleration: 0,
            turnRateDegreesPerSecond: 90,
            keySteerInitialScale: 0.35,
            keySteerRampSeconds: 1,
            cameraHeight: 1.45
        });

        controller.speed = 0.5;
        press("ArrowRight", "ArrowRight");
        now = 100;
        jest.advanceTimersByTime(20);

        const directionY = view.camera.look[1] - view.camera.eye[1];
        expect(directionY).toBeLessThan(-0.01);

        release("ArrowRight", "ArrowRight");
        controller.destroy();
        jest.advanceTimersByTime(20);
    });

    it("turns more sharply at low ground speed than at high ground speed", () => {
        const turnAtSpeed = (speed: number) => {
            const view = makeView();
            const controller = new VehicleNavigationController(view, {
                active: true,
                raycaster: makeMissRaycaster() as any,
                keyboardEnabledOnlyOnMouseover: false,
                collision: false,
                gravity: false,
                maxForwardSpeed: 10,
                coastDeceleration: 0,
                turnRateDegreesPerSecond: 90,
                keySteerInitialScale: 1,
                keySteerRampSeconds: 0.001,
                leanDegrees: 0,
                cameraHeight: 1.45
            });
            controller.speed = speed;
            press("ArrowRight", "ArrowRight");
            now += 100;
            jest.advanceTimersByTime(20);
            const directionY = view.camera.look[1] - view.camera.eye[1];
            release("ArrowRight", "ArrowRight");
            controller.destroy();
            jest.advanceTimersByTime(20);
            return Math.abs(directionY);
        };

        const slowTurn = turnAtSpeed(1);
        const fastTurn = turnAtSpeed(10);

        expect(slowTurn).toBeGreaterThan(fastTurn * 1.8);
    });

    it("banks more quickly and deeply at higher ground speed", () => {
        const leanAtSpeed = (speed: number) => {
            const view = makeView();
            const controller = new VehicleNavigationController(view, {
                active: true,
                raycaster: makeMissRaycaster() as any,
                keyboardEnabledOnlyOnMouseover: false,
                collision: false,
                gravity: false,
                maxForwardSpeed: 10,
                coastDeceleration: 0,
                turnRateDegreesPerSecond: 90,
                keySteerInitialScale: 1,
                keySteerRampSeconds: 0.001,
                leanDegrees: 20,
                leanSmoothing: 8,
                cameraHeight: 1.45
            });
            controller.speed = speed;
            press("ArrowRight", "ArrowRight");
            now += 100;
            jest.advanceTimersByTime(20);
            const lean = Math.abs(view.camera.up[1]);
            release("ArrowRight", "ArrowRight");
            controller.destroy();
            jest.advanceTimersByTime(20);
            return lean;
        };

        const slowLean = leanAtSpeed(1);
        const fastLean = leanAtSpeed(10);

        expect(fastLean).toBeGreaterThan(slowLean * 8);
    });

    it("eases view pitch upward while travelling up a drive-surface gradient", () => {
        const view = makeView();
        const controller = new VehicleNavigationController(view, {
            active: true,
            raycaster: makeSlopedSurfaceRaycaster(0.5) as any,
            keyboardEnabledOnlyOnMouseover: false,
            collision: true,
            gravity: true,
            maxForwardSpeed: 10,
            coastDeceleration: 0,
            cameraHeight: 1.45
        });

        controller.speed = 5;
        now += 100;
        jest.advanceTimersByTime(20);

        expect(view.camera.look[2] - view.camera.eye[2]).toBeGreaterThan(0.05);
        controller.destroy();
        jest.advanceTimersByTime(20);
    });

    it("eases view pitch downward while travelling down a drive-surface gradient", () => {
        const view = makeView();
        const controller = new VehicleNavigationController(view, {
            active: true,
            raycaster: makeSlopedSurfaceRaycaster(-0.5) as any,
            keyboardEnabledOnlyOnMouseover: false,
            collision: true,
            gravity: true,
            maxForwardSpeed: 10,
            coastDeceleration: 0,
            cameraHeight: 1.45
        });

        controller.speed = 5;
        now += 100;
        jest.advanceTimersByTime(20);

        expect(view.camera.look[2] - view.camera.eye[2]).toBeLessThan(-0.05);
        controller.destroy();
        jest.advanceTimersByTime(20);
    });

    it("toggles flight with Space, lifts off, and drops to the drive surface", () => {
        const view = makeView();
        const controller = new VehicleNavigationController(view, {
            active: true,
            raycaster: makeFlatSurfaceRaycaster() as any,
            keyboardEnabledOnlyOnMouseover: false,
            collision: true,
            gravity: true,
            cameraHeight: 1.45,
            flightTakeoffHeight: 2,
            flightTakeoffSpeed: 10,
            flightLandingFallSpeed: 10,
            maxFallSpeed: 30
        });

        press("Space", " ");
        expect(controller.flying).toBe(true);
        now = 100;
        jest.advanceTimersByTime(20);

        expect(view.camera.eye[2]).toBeGreaterThan(1.45);
        expect(view.camera.eye[0]).toBeGreaterThan(0);

        release("Space", " ");
        press("Space", " ");
        expect(controller.flying).toBe(false);

        for (let i = 0; i < 30 && view.camera.eye[2] > 1.45; i++) {
            now += 100;
            jest.advanceTimersByTime(20);
        }

        expect(view.camera.eye[2]).toBeCloseTo(1.45, 4);
        controller.destroy();
        jest.advanceTimersByTime(20);
    });

    it("glides on flight momentum and softly lands on a rooftop after releasing throttle", () => {
        const view = makeView();
        const controller = new VehicleNavigationController(view, {
            active: true,
            raycaster: makeFlatSurfaceRaycaster(2) as any,
            keyboardEnabledOnlyOnMouseover: false,
            collision: true,
            gravity: true,
            cameraHeight: 1.45,
            flightTakeoffHeight: 0,
            flightAcceleration: 12,
            flightAirDrag: 0.1,
            flightGravity: 4,
            flightSoftLandingRange: 0.4,
            maxForwardSpeed: 24,
            maxFallSpeed: 30
        });

        press("Space", " ");
        release("Space", " ");
        press("ArrowUp", "ArrowUp");
        press("KeyW", "w");

        for (let i = 0; i < 8; i++) {
            now += 100;
            jest.advanceTimersByTime(20);
        }

        release("ArrowUp", "ArrowUp");
        release("KeyW", "w");
        const xAfterThrottleRelease = view.camera.eye[0];
        expect(xAfterThrottleRelease).toBeGreaterThan(0);
        expect(controller.flying).toBe(true);

        for (let i = 0; i < 100 && controller.flying; i++) {
            now += 100;
            jest.advanceTimersByTime(20);
        }

        expect(controller.flying).toBe(false);
        expect(view.camera.eye[0]).toBeGreaterThan(xAfterThrottleRelease + 1);
        expect(view.camera.eye[2]).toBeCloseTo(3.45, 4);
        controller.destroy();
        jest.advanceTimersByTime(20);
    });

    it("uses ArrowUp for pitch up and ArrowDown for pitch down while flying", () => {
        const view = makeView();
        const controller = new VehicleNavigationController(view, {
            active: true,
            raycaster: makeMissRaycaster() as any,
            keyboardEnabledOnlyOnMouseover: false,
            collision: false,
            gravity: false,
            flightTakeoffHeight: 0,
            flightMinGlideSpeed: 0,
            flightGravity: 0,
            flightPitchRateDegreesPerSecond: 60,
            maxForwardSpeed: 20
        });

        press("Space", " ");
        release("Space", " ");
        press("ArrowUp", "ArrowUp");
        now = 100;
        jest.advanceTimersByTime(20);

        const pitchUpDirection = [
            view.camera.look[0] - view.camera.eye[0],
            view.camera.look[1] - view.camera.eye[1],
            view.camera.look[2] - view.camera.eye[2]
        ];
        expect(pitchUpDirection[2]).toBeGreaterThan(0);
        expect(controller.speed).toBe(0);

        release("ArrowUp", "ArrowUp");
        press("ArrowDown", "ArrowDown");
        now = 200;
        jest.advanceTimersByTime(20);

        const pitchDownDirection = [
            view.camera.look[0] - view.camera.eye[0],
            view.camera.look[1] - view.camera.eye[1],
            view.camera.look[2] - view.camera.eye[2]
        ];
        expect(pitchDownDirection[2]).toBeLessThan(pitchUpDirection[2]);

        release("ArrowDown", "ArrowDown");
        controller.destroy();
        jest.advanceTimersByTime(20);
    });

    it("ramps arrow-key elevator deflection and steers flight velocity when aircraft control surfaces are enabled", () => {
        const view = makeView();
        const controller = new VehicleNavigationController(view, {
            active: true,
            raycaster: makeMissRaycaster() as any,
            keyboardEnabledOnlyOnMouseover: false,
            collision: false,
            gravity: false,
            flightTakeoffHeight: 0,
            flightMinGlideSpeed: 8,
            flightGravity: 0,
            flightAirDrag: 0,
            flightPitchRateDegreesPerSecond: 60,
            flightSteeringResponse: 10,
            aircraftControlSurfaces: true,
            controlSurfaceResponse: 2,
            controlSurfaceReturnResponse: 2,
            maxForwardSpeed: 20
        });

        press("Space", " ");
        release("Space", " ");
        const startZ = view.camera.eye[2];
        press("ArrowUp", "ArrowUp");

        now = 100;
        jest.advanceTimersByTime(20);
        const earlyPitch = view.camera.look[2] - view.camera.eye[2];
        const earlyZ = view.camera.eye[2];

        now = 700;
        jest.advanceTimersByTime(20);
        const laterPitch = view.camera.look[2] - view.camera.eye[2];

        expect(earlyPitch).toBeGreaterThan(0);
        expect(laterPitch).toBeGreaterThan(earlyPitch + 0.01);
        expect(view.camera.eye[2]).toBeGreaterThan(earlyZ);
        expect(view.camera.eye[2]).toBeGreaterThan(startZ);

        release("ArrowUp", "ArrowUp");
        controller.destroy();
        jest.advanceTimersByTime(20);
    });

    it("routes mouse drag through elevator deflection when aircraft control surfaces are enabled", () => {
        const view = makeView();
        const controller = new VehicleNavigationController(view, {
            active: true,
            raycaster: makeMissRaycaster() as any,
            keyboardEnabledOnlyOnMouseover: false,
            collision: false,
            gravity: false,
            flightTakeoffHeight: 0,
            flightMinGlideSpeed: 8,
            flightGravity: 0,
            flightAirDrag: 0,
            flightPitchRateDegreesPerSecond: 60,
            flightSteeringResponse: 10,
            aircraftControlSurfaces: true,
            controlSurfaceResponse: 2,
            controlSurfaceReturnResponse: 2,
            mouseDragResponse: 6,
            mouseDragPitchSensitivity: 0.02,
            maxMouseDragInputPerFrame: 1,
            maxForwardSpeed: 20
        });

        press("Space", " ");
        release("Space", " ");
        const startZ = view.camera.eye[2];
        pointerDown(view.htmlElement, 100, 50);
        dragPointer(view.htmlElement, 100, 10, 0, -40);

        now = 100;
        jest.advanceTimersByTime(20);
        const earlyPitch = view.camera.look[2] - view.camera.eye[2];

        now = 700;
        jest.advanceTimersByTime(20);
        const laterPitch = view.camera.look[2] - view.camera.eye[2];

        expect(earlyPitch).toBeGreaterThan(0);
        expect(laterPitch).toBeGreaterThan(earlyPitch + 0.01);
        expect(view.camera.eye[2]).toBeGreaterThan(startZ);

        pointerUp(view.htmlElement, 100, 10);
        controller.destroy();
        jest.advanceTimersByTime(20);
    });

    it("climbs from pitch input while gliding without throttle", () => {
        const view = makeView();
        const controller = new VehicleNavigationController(view, {
            active: true,
            raycaster: makeMissRaycaster() as any,
            keyboardEnabledOnlyOnMouseover: false,
            collision: false,
            gravity: false,
            flightTakeoffHeight: 0,
            flightMinGlideSpeed: 8,
            flightGravity: 0,
            flightPitchRateDegreesPerSecond: 60,
            flightSteeringResponse: 10,
            maxForwardSpeed: 20
        });

        press("Space", " ");
        release("Space", " ");
        const startZ = view.camera.eye[2];
        press("ArrowUp", "ArrowUp");
        now = 100;
        jest.advanceTimersByTime(20);

        expect(view.camera.look[2] - view.camera.eye[2]).toBeGreaterThan(0);
        expect(view.camera.eye[2]).toBeGreaterThan(startZ);

        release("ArrowUp", "ArrowUp");
        controller.destroy();
        jest.advanceTimersByTime(20);
    });

    it("follows pitched glide direction while braking at minimum flight speed", () => {
        const view = makeView();
        const controller = new VehicleNavigationController(view, {
            active: true,
            raycaster: makeMissRaycaster() as any,
            keyboardEnabledOnlyOnMouseover: false,
            collision: false,
            gravity: false,
            flightTakeoffHeight: 0,
            flightMinGlideSpeed: 8,
            flightGravity: 0,
            flightAirDrag: 0,
            flightBrakeDeceleration: 120,
            maxForwardSpeed: 20
        });

        view.camera.look = [1, 0, 0.45];
        press("Space", " ");
        release("Space", " ");
        const startDownZ = view.camera.eye[2];
        press("KeyS", "s");
        now = 100;
        jest.advanceTimersByTime(20);

        expect(view.camera.eye[2]).toBeLessThan(startDownZ);

        release("KeyS", "s");
        controller.destroy();
        jest.advanceTimersByTime(20);

        const climbView = makeView();
        const climbController = new VehicleNavigationController(climbView, {
            active: true,
            raycaster: makeMissRaycaster() as any,
            keyboardEnabledOnlyOnMouseover: false,
            collision: false,
            gravity: false,
            flightTakeoffHeight: 0,
            flightMinGlideSpeed: 8,
            flightGravity: 0,
            flightAirDrag: 0,
            flightBrakeDeceleration: 120,
            maxForwardSpeed: 20
        });

        climbView.camera.look = [1, 0, 2.45];
        press("Space", " ");
        release("Space", " ");
        const startUpZ = climbView.camera.eye[2];
        press("KeyS", "s");
        now = 220;
        jest.advanceTimersByTime(20);

        expect(climbView.camera.eye[2]).toBeGreaterThan(startUpZ);

        release("KeyS", "s");
        climbController.destroy();
        jest.advanceTimersByTime(20);
    });

    it("turns the flight heading from arrow keys without throttle", () => {
        const view = makeView();
        const controller = new VehicleNavigationController(view, {
            active: true,
            raycaster: makeMissRaycaster() as any,
            keyboardEnabledOnlyOnMouseover: false,
            collision: false,
            gravity: false,
            flightTakeoffHeight: 0,
            flightMinGlideSpeed: 0,
            flightGravity: 0,
            turnRateDegreesPerSecond: 90,
            keySteerInitialScale: 0.5,
            maxForwardSpeed: 20
        });

        press("Space", " ");
        release("Space", " ");
        press("ArrowRight", "ArrowRight");
        now = 100;
        jest.advanceTimersByTime(20);

        const directionY = view.camera.look[1] - view.camera.eye[1];
        expect(directionY).toBeLessThan(-0.01);
        expect(controller.speed).toBe(0);

        release("ArrowRight", "ArrowRight");
        controller.destroy();
        jest.advanceTimersByTime(20);
    });

    it("blocks flight movement against side-radius obstacles", () => {
        const view = makeView();
        const raycaster = makeSideObstacleRaycaster();
        const controller = new VehicleNavigationController(view, {
            active: true,
            raycaster: raycaster as any,
            keyboardEnabledOnlyOnMouseover: false,
            collision: true,
            gravity: false,
            bodyRadius: 1,
            flightTakeoffHeight: 0,
            flightMinGlideSpeed: 0,
            flightGravity: 0,
            maxForwardSpeed: 20
        });

        press("Space", " ");
        release("Space", " ");
        controller.speed = 10;
        press("KeyW", "w");
        now = 100;
        jest.advanceTimersByTime(20);

        expect(view.camera.eye[0]).toBeCloseTo(0, 6);
        expect(controller.speed).toBe(0);
        expect(raycaster.pick).toHaveBeenCalledWith(expect.objectContaining({
            ray: expect.objectContaining({
                origin: expect.arrayContaining([expect.any(Number), expect.any(Number), expect.any(Number)])
            })
        }));
        expect(raycaster.pick.mock.calls.some(([call]) => Math.abs(call.ray.origin[1]) >= 1)).toBe(true);

        release("KeyW", "w");
        controller.destroy();
        jest.advanceTimersByTime(20);
    });

    it("keeps flight mode active when the window loses focus", () => {
        const view = makeView();
        const controller = new VehicleNavigationController(view, {
            active: true,
            raycaster: makeMissRaycaster() as any,
            keyboardEnabledOnlyOnMouseover: false
        });

        press("Space", " ");
        release("Space", " ");
        expect(controller.flying).toBe(true);

        window.dispatchEvent({type: "blur"} as any);
        expect(controller.flying).toBe(true);

        controller.destroy();
        jest.advanceTimersByTime(20);
    });
});
