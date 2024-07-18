/**
 * @private
 */
import {createVec2, createVec3, lenVec3, subVec3} from "@xeokit/matrix";
import {KEY_SHIFT} from "./keycodes";
import {View} from "@xeokit/viewer";
import {PerspectiveProjectionType} from "@xeokit/constants";


const canvasPos = createVec2();

export const getCanvasPosFromEvent = function (event, canvasPos) {
    if (!event) {
        event = window.event;
        canvasPos[0] = event.x;
        canvasPos[1] = event.y;
    } else {
        let element = event.target;
        let totalOffsetLeft = 0;
        let totalOffsetTop = 0;
        let totalScrollX = 0;
        let totalScrollY = 0;
        while (element.offsetParent) {
          totalOffsetLeft += element.offsetLeft;
          totalOffsetTop += element.offsetTop;
          totalScrollX += element.scrollLeft;
          totalScrollY += element.scrollTop;
          element = element.offsetParent;
        }
        canvasPos[0] = event.pageX + totalScrollX - totalOffsetLeft;
        canvasPos[1] = event.pageY + totalScrollY - totalOffsetTop;
    }
    return canvasPos;
};

/**
 * @private
 */
export class MousePanRotateDollyHandler {
    #canvasMouseMoveHandler: (e) => void;
    #documentKeyDownHandler: (e) => void;
    #documentKeyUpHandler: (e) => void;
    #view: View;
    #documentMouseUpHandler: (e) => void;
    #mouseEnterHandler: () => void;
    #mouseDownHandler: (e) => void;
    #documentMouseMoveHandler: (e) => void;
    #mouseUpHandler: (e) => void;
    #mouseWheelHandler: (e) => void;

    constructor(view:View, controllers:any, configs:any, states:any, updates:any) {

        this.#view = view;

        const pickController = controllers.pickController;

        let lastX = 0;
        let lastY = 0;
        let lastXDown = 0;
        let lastYDown = 0;
        let xRotateDelta = 0;
        let yRotateDelta = 0;

        let mouseDownLeft;
        let mouseDownMiddle;
        let mouseDownRight;

        let mouseDownPicked = false;
        const pickedWorldPos = createVec3();

        let mouseMovedOnCanvasSinceLastWheel = true;

        const htmlElement = this.#view.htmlElement;

        const keyDown = [];

        document.addEventListener("keydown", this.#documentKeyDownHandler = (e) => {
            // if (!(configs.active && configs.pointerEnabled) || (!view.input.keyboardEnabled)) {
            //     return;
            // }
            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }
            const keyCode = e.keyCode;
            keyDown[keyCode] = true;
        });

        document.addEventListener("keyup", this.#documentKeyUpHandler = (e) => {
            // if (!(configs.active && configs.pointerEnabled) || (!view.input.keyboardEnabled)) {
            //     return;
            // }
            if (!(configs.active && configs.pointerEnabled) ) {
                return;
            }
            const keyCode = e.keyCode;
            keyDown[keyCode] = false;
        });

        function setMousedownState(pick = true) {
            htmlElement.style.cursor = "move";
            setMousedownPositions();
            if (pick) {
                setMousedownPick();
            }
        }

        function setMousedownPositions() {
            xRotateDelta = 0;
            yRotateDelta = 0;

            lastX = states.pointerCanvasPos[0];
            lastY = states.pointerCanvasPos[1];
            lastXDown = states.pointerCanvasPos[0];
            lastYDown = states.pointerCanvasPos[1];
        }

        function setMousedownPick() {
            pickController.pickCursorPos = states.pointerCanvasPos;
            pickController.schedulePickSurface = true;
            pickController.update();

            if (pickController.picked && pickController.pickedSurface && pickController.pickResult && pickController.pickResult.worldPos) {
                mouseDownPicked = true;
                pickedWorldPos.set(pickController.pickResult.worldPos);
            } else {
                mouseDownPicked = false;
            }
        }

        htmlElement.addEventListener("mousedown", this.#mouseDownHandler = (e) => {

            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }

            switch (e.which) {

                case 1: // Left button

                    if (keyDown[KEY_SHIFT] || configs.planView) {

                        mouseDownLeft = true;

                        setMousedownState();

                    } else {

                        mouseDownLeft = true;

                        setMousedownState(false);
                    }

                    break;

                case 2: // Middle/both buttons

                    mouseDownMiddle = true;

                    setMousedownState();

                    break;

                case 3: // Right button

                    mouseDownRight = true;

                    if (configs.panRightClick) {

                        setMousedownState();
                    }

                    break;

                default:
                    break;
            }
        });

        document.addEventListener("mousemove", this.#documentMouseMoveHandler = (e) => {

            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }

            if (!mouseDownLeft && !mouseDownMiddle && !mouseDownRight) {
                return;
            }

            // Scaling drag-rotate to canvas boundary

            const canvasBoundary = view.boundary;

            const canvasWidth = canvasBoundary[2];
            const canvasHeight = canvasBoundary[3];
            const x = states.pointerCanvasPos[0];
            const y = states.pointerCanvasPos[1];

            const panning = keyDown[KEY_SHIFT] || configs.planView || (!configs.panRightClick && mouseDownMiddle) || (configs.panRightClick && mouseDownRight);

            const xDelta = document.pointerLockElement ? e.movementX : (x - lastX);
            const yDelta = document.pointerLockElement ? e.movementY : (y - lastY);

            if (panning) {

                const camera = view.camera;

                // We use only canvasHeight here so that aspect ratio does not distort speed

                if (camera.projectionType === PerspectiveProjectionType) {

                    const depth = Math.abs(mouseDownPicked ? lenVec3(subVec3(pickedWorldPos, view.camera.eye, [])) : view.camera.eyeLookDist);
                    const targetDistance = depth * Math.tan((camera.perspectiveProjection.fov / 2) * Math.PI / 180.0);

                    updates.panDeltaX += (1.5 * xDelta * targetDistance / canvasHeight);
                    updates.panDeltaY += (1.5 * yDelta * targetDistance / canvasHeight);

                } else {

                    updates.panDeltaX += 0.5 * camera.orthoProjection.scale * (xDelta / canvasHeight);
                    updates.panDeltaY += 0.5 * camera.orthoProjection.scale * (yDelta / canvasHeight);
                }

            } else if (mouseDownLeft && !mouseDownMiddle && !mouseDownRight) {

                if (!configs.planView) { // No rotating in plan-view mode

                    if (configs.firstPerson) {
                        updates.rotateDeltaY -= (xDelta / canvasWidth) * configs.dragRotationRate / 2;
                        updates.rotateDeltaX += (yDelta / canvasHeight) * (configs.dragRotationRate / 4);

                    } else {
                        updates.rotateDeltaY -= (xDelta / canvasWidth) * (configs.dragRotationRate * 1.5);
                        updates.rotateDeltaX += (yDelta / canvasHeight) * (configs.dragRotationRate * 1.5);
                    }
                }
            }

            lastX = x;
            lastY = y;
        });

        htmlElement.addEventListener("mousemove", this.#canvasMouseMoveHandler = (e) => {

            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }

            if (!states.mouseover) {
                return;
            }

            mouseMovedOnCanvasSinceLastWheel = true;
        });

        document.addEventListener("mouseup", this.#documentMouseUpHandler = (e) => {
            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }
            switch (e.which) {
                case 1: // Left button
                    mouseDownLeft = false;
                    mouseDownMiddle = false;
                    mouseDownRight = false;
                    break;
                case 2: // Middle/both buttons
                    mouseDownLeft = false;
                    mouseDownMiddle = false;
                    mouseDownRight = false;
                    break;
                case 3: // Right button
                    mouseDownLeft = false;
                    mouseDownMiddle = false;
                    mouseDownRight = false;
                    break;
                default:
                    break;
            }
            xRotateDelta = 0;
            yRotateDelta = 0;
        });

        htmlElement.addEventListener("mouseup", this.#mouseUpHandler = (e) => {
            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }
            switch (e.which) {
                case 3: // Right button
                    getCanvasPosFromEvent(e, canvasPos);
                    const x = canvasPos[0];
                    const y = canvasPos[1];
                    if (Math.abs(x - lastXDown) < 3 && Math.abs(y - lastYDown) < 3) {
                        controllers.cameraControl.fire("rightClick", { // For context menus
                            pagePos: [Math.round(e.pageX), Math.round(e.pageY)],
                            canvasPos: canvasPos,
                            event: e
                        }, true);
                    }
                    break;
                default:
                    break;
            }
            htmlElement.style.removeProperty("cursor");
        });

        htmlElement.addEventListener("mouseenter", this.#mouseEnterHandler = () => {
            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }
            xRotateDelta = 0;
            yRotateDelta = 0;
        });

        const maxElapsed = 1 / 20;
        const minElapsed = 1 / 60;

        let secsNowLast = null;

        htmlElement.addEventListener("wheel", this.#mouseWheelHandler = (e) => {
            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }
            const secsNow = performance.now() / 1000.0;
            var secsElapsed = (secsNowLast !== null) ? (secsNow - secsNowLast) : 0;
            secsNowLast = secsNow;
            if (secsElapsed > maxElapsed) {
                secsElapsed = maxElapsed;
            }
            if (secsElapsed < minElapsed) {
                secsElapsed = minElapsed;
            }
            const delta = Math.max(-1, Math.min(1, -e.deltaY * 40));
            if (delta === 0) {
                return;
            }
            const normalizedDelta = delta / Math.abs(delta);
            updates.dollyDelta += -normalizedDelta * secsElapsed * configs.mouseWheelDollyRate;

            if (mouseMovedOnCanvasSinceLastWheel) {
                states.followPointerDirty = true;
                mouseMovedOnCanvasSinceLastWheel = false;
            }

        }, {passive: true});
    }

    reset() {
    }

    destroy() {

        const htmlElement = this.#view.htmlElement;

        document.removeEventListener("keydown", this.#documentKeyDownHandler);
        document.removeEventListener("keyup", this.#documentKeyUpHandler);
        htmlElement.removeEventListener("mousedown", this.#mouseDownHandler);
        document.removeEventListener("mousemove", this.#documentMouseMoveHandler);
        htmlElement.removeEventListener("mousemove", this.#canvasMouseMoveHandler);
        document.removeEventListener("mouseup", this.#documentMouseUpHandler);
        htmlElement.removeEventListener("mouseup", this.#mouseUpHandler);
        htmlElement.removeEventListener("mouseenter", this.#mouseEnterHandler);
        htmlElement.removeEventListener("wheel", this.#mouseWheelHandler);
    }
}


