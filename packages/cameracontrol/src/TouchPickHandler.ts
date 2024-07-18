import {PickResult, View} from "@xeokit/viewer";
import {distVec2, subVec3} from "@xeokit/matrix";


const TAP_INTERVAL = 150;
const DBL_TAP_INTERVAL = 325;
const TAP_DISTANCE_THRESHOLD = 4;

const getCanvasPosFromEvent = function (event, canvasPos) {
    if (!event) {
        event = window.event;
        canvasPos[0] = event.x;
        canvasPos[1] = event.y;
    } else {
        let element = event.target;
        let totalOffsetLeft = 0;
        let totalOffsetTop = 0;
        while (element.offsetParent) {
            totalOffsetLeft += element.offsetLeft;
            totalOffsetTop += element.offsetTop;
            element = element.offsetParent;
        }
        canvasPos[0] = event.pageX - totalOffsetLeft;
        canvasPos[1] = event.pageY - totalOffsetTop;
    }
    return canvasPos;
};

/**
 * @private
 */
export class TouchPickHandler {

    #view: View;
    #canvasTouchStartHandler: (e) => void;
    #canvasTouchEndHandler: (e) => void;

    constructor(view: View, controllers: any, configs: any, states: any, updates: any) {

        this.#view = view;

        const pickController = controllers.pickController;
        const cameraControl = controllers.cameraControl;

        let touchStartTime;
        const activeTouches = [];
        const tapStartPos = new Float32Array(2);
        let tapStartTime = -1;
        let lastTapTime = -1;

        const htmlElement = this.#view.htmlElement;

        const flyCameraTo = (pickResult?: PickResult) => {
            let pos;
            if (pickResult && pickResult.worldPos) {
                pos = pickResult.worldPos
            }
            const aabb = pickResult ? pickResult.viewObject.aabb : view.aabb;
            if (pos) { // Fly to look at point, don't change eye->look dist
                const camera = view.camera;
                const diff = subVec3(camera.eye, camera.look, []);
                controllers.cameraFlight.flyTo({
                    aabb: aabb
                });
                // TODO: Option to back off to fit AABB in view
            } else {// Fly to fit target boundary in view
                controllers.cameraFlight.flyTo({
                    aabb: aabb
                });
            }
        };

        htmlElement.addEventListener("touchstart", this.#canvasTouchStartHandler = (e) => {

            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }

            if (states.longTouchTimeout !== null) {
                clearTimeout(states.longTouchTimeout);
                states.longTouchTimeout = null;
            }

            const touches = e.touches;
            const changedTouches = e.changedTouches;

            touchStartTime = Date.now();

            if (touches.length === 1 && changedTouches.length === 1) {
                tapStartTime = touchStartTime;

                getCanvasPosFromEvent(touches[0], tapStartPos);

                const rightClickClientX = tapStartPos[0];
                const rightClickClientY = tapStartPos[1];

                const rightClickPageX = touches[0].pageX;
                const rightClickPageY = touches[0].pageY;

                states.longTouchTimeout = setTimeout(() => {
                    controllers.cameraControl.fire("rightClick", { // For context menus
                        pagePos: [Math.round(rightClickPageX), Math.round(rightClickPageY)],
                        canvasPos: [Math.round(rightClickClientX), Math.round(rightClickClientY)],
                        event: e
                    }, true);

                    states.longTouchTimeout = null;
                }, configs.longTapTimeout);

            } else {
                tapStartTime = -1;
            }

            while (activeTouches.length < touches.length) {
                activeTouches.push(new Float32Array(2))
            }

            for (let i = 0, len = touches.length; i < len; ++i) {
                getCanvasPosFromEvent(touches[i], activeTouches[i]);
            }

            activeTouches.length = touches.length;

        }, {passive: true});


        htmlElement.addEventListener("touchend", this.#canvasTouchEndHandler = (e) => {

            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }

            const currentTime = Date.now();
            const touches = e.touches;
            const changedTouches = e.changedTouches;

            const pickedSurfaceSubs = cameraControl.hasSubs("pickedSurface");

            if (states.longTouchTimeout !== null) {
                clearTimeout(states.longTouchTimeout);
                states.longTouchTimeout = null;
            }

            // process tap

            if (touches.length === 0 && changedTouches.length === 1) {

                if (tapStartTime > -1 && currentTime - tapStartTime < TAP_INTERVAL) {

                    if (lastTapTime > -1 && tapStartTime - lastTapTime < DBL_TAP_INTERVAL) {

                        // Double-tap

                        getCanvasPosFromEvent(changedTouches[0], pickController.pickCursorPos);
                        pickController.schedulePickEntity = true;
                        pickController.schedulePickSurface = pickedSurfaceSubs;

                        pickController.update();

                        if (pickController.pickResult) {

                            pickController.pickResult.touchInput = true;

                            cameraControl.fire("doublePicked", pickController.pickResult);

                            if (pickController.pickedSurface) {
                                cameraControl.fire("doublePickedSurface", pickController.pickResult);
                            }

                            if (configs.doublePickFlyTo) {
                                flyCameraTo(pickController.pickResult);
                            }
                        } else {
                            cameraControl.fire("doublePickedNothing");
                            if (configs.doublePickFlyTo) {
                                flyCameraTo();
                            }
                        }

                        lastTapTime = -1;

                    } else if (distVec2(activeTouches[0], tapStartPos) < TAP_DISTANCE_THRESHOLD) {

                        // Single-tap

                        getCanvasPosFromEvent(changedTouches[0], pickController.pickCursorPos);
                        pickController.schedulePickEntity = true;
                        pickController.schedulePickSurface = pickedSurfaceSubs;

                        pickController.update();

                        if (pickController.pickResult) {

                            pickController.pickResult.touchInput = true;

                            cameraControl.fire("picked", pickController.pickResult);

                            if (pickController.pickedSurface) {
                                cameraControl.fire("pickedSurface", pickController.pickResult);
                            }

                        } else {
                            cameraControl.fire("pickedNothing");
                        }

                        lastTapTime = currentTime;
                    }

                    tapStartTime = -1
                }
            }

            activeTouches.length = touches.length;

            for (let i = 0, len = touches.length; i < len; ++i) {
                activeTouches[i][0] = touches[i].pageX;
                activeTouches[i][1] = touches[i].pageY;
            }

            //  e.stopPropagation();

        }, {passive: true});

    }

    reset(): void {
        // TODO
        // tapStartTime = -1;
        // lastTapTime = -1;

    }

    destroy(): void {
        const htmlElement = this.#view.htmlElement;
        htmlElement.removeEventListener("touchstart", this.#canvasTouchStartHandler);
        htmlElement.removeEventListener("touchend", this.#canvasTouchEndHandler);
    }
}
