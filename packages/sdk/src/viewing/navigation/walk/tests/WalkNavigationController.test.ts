import type {Vec3} from "../../../../base/math/vector";
import {WalkNavigationController} from "../WalkNavigationController";

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
}

function makeView() {
    return {
        htmlElement: new FakeHTMLElement(),
        camera: {
            eye: [0, 0, 1.7],
            look: [1, 0, 1.7],
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

function makeEdgeRaycaster(edgeX = 0.2) {
    return {
        pick: jest.fn((params) => {
            const ray = params.ray;
            const origin = ray.origin as Vec3;
            const dir = ray.dir as Vec3;
            if (dir[2] < -0.5 && origin[0] <= edgeX) {
                return hit([origin[0], origin[1], 0], [0, 0, 1]);
            }
            return miss();
        })
    };
}

function hit(worldPos: Vec3, worldNormal: Vec3) {
    return {
        ok: true,
        value: {
            hit: true,
            objectId: "floor",
            meshId: "floorMesh",
            worldPos,
            worldNormal,
            tHit: 1,
            triangleIndex: 0,
            rayOrigin: [worldPos[0], worldPos[1], worldPos[2] + 1],
            rayDir: [0, 0, -1]
        }
    };
}

function miss() {
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
            rayOrigin: [0, 0, 0],
            rayDir: [0, 0, -1]
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

describe("WalkNavigationController", () => {
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

    it("falls after walking off a ledge and keeps falling without movement input", () => {
        const view = makeView();
        const raycaster = makeEdgeRaycaster();
        const controller = new WalkNavigationController(view, {
            active: true,
            raycaster: raycaster as any,
            keyboardEnabledOnlyOnMouseover: false,
            collision: false,
            eyeHeight: 1.7,
            walkSpeed: 10,
            maxFall: 0.2,
            fallAcceleration: 10,
            maxFallSpeed: 50
        });

        press("KeyW", "w");
        now = 100;
        jest.advanceTimersByTime(20);
        const eyeAfterWalkingOffEdge = view.camera.eye[2];

        release("KeyW", "w");
        now = 200;
        jest.advanceTimersByTime(20);

        expect(eyeAfterWalkingOffEdge).toBeLessThan(1.7);
        expect(view.camera.eye[2]).toBeLessThan(eyeAfterWalkingOffEdge);
        controller.destroy();
    });

    it("uses faster default walking and running speeds", () => {
        const view = makeView();
        const controller = new WalkNavigationController(view, {
            active: false,
            raycaster: makeEdgeRaycaster() as any
        });

        expect(controller.walkSpeed).toBe(4);
        expect(controller.runSpeed).toBe(8.5);
        controller.destroy();
    });
});
