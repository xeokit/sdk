import * as math from "../../../../math";
import {View} from "../../../View";

const canvasPos = math.vec2();

const getCanvasPosFromEvent = function (event:any, canvasPos:any) {
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
class MousePanRotateDollyHandler {

    #view: View;
    #documentKeyDownHandler: (e: any) => void;
    #documentKeyUpHandler: (e: any) => void;
    #mouseDownHandler: (e: any) => void;
    #documentMouseMoveHandler: () => void;
    #canvasMouseMoveHandler: (e: any) => void;
    #documentMouseUpHandler: (e: any) => void;
    #mouseUpHandler: (e: any) => void;
    #mouseEnterHandler: (e: any) => void;
    #mouseWheelHandler: (e: { deltaY: number; preventDefault: () => void }) => void;

    constructor(components:any, controllers:any, configs:any, states:any, updates:any) {

        this.#view = components.view;

        const pickController = controllers.pickController;

        let lastX = 0;
        let lastY = 0;
        let lastXDown = 0;
        let lastYDown = 0;
        let xRotateDelta = 0;
        let yRotateDelta = 0;

        let mouseDownLeft: boolean;
        let mouseDownMiddle: boolean;
        let mouseDownRight: boolean;

        let mouseDownPicked = false;
        const pickedWorldPos = math.vec3();

        let mouseMovedOnCanvasSinceLastWheel = true;

        const canvas = this.#view.canvas.canvas;

        const keyDown: any[] = [];

        document.addEventListener("keydown", this.#documentKeyDownHandler = (e) => {
            if (!(configs.active && configs.pointerEnabled) || (!this.#view.input.keyboardEnabled)) {
                return;
            }
            const keyCode = e.keyCode;
            keyDown[keyCode] = true;
        });

        document.addEventListener("keyup", this.#documentKeyUpHandler = (e) => {
            if (!(configs.active && configs.pointerEnabled) || (!this.#view.input.keyboardEnabled)) {
                return;
            }
            const keyCode = e.keyCode;
            keyDown[keyCode] = false;
        });

        function setMousedownState(pick = true) {
            canvas.style.cursor = "move";
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

        canvas.addEventListener("mousedown", this.#mouseDownHandler = (e) => {
            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }
            switch (e.which) {
                case 1: // Left button
                    if (keyDown[this.#view.input.KEY_SHIFT] || configs.planView) {
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

        document.addEventListener("mousemove", this.#documentMouseMoveHandler = () => {

            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }

            if (!mouseDownLeft && !mouseDownMiddle && !mouseDownRight) {
                return;
            }

            // Scaling drag-rotate to canvas boundary

            const canvasBoundary = this.#view.canvas.boundary;
            const canvasWidth = canvasBoundary[2] - canvasBoundary[0];
            const canvasHeight = canvasBoundary[3] - canvasBoundary[1];
            const x = states.pointerCanvasPos[0];
            const y = states.pointerCanvasPos[1];

            const panning = keyDown[this.#view.input.KEY_SHIFT] || configs.planView || (!configs.panRightClick && mouseDownMiddle) || (configs.panRightClick && mouseDownRight);

            if (panning) {

                const xPanDelta = (x - lastX);
                const yPanDelta = (y - lastY);

                const camera = this.#view.camera;

                // We use only canvasHeight here so that aspect ratio does not distort speed

                if (camera.projection === "perspective") {

                    const depth = Math.abs(mouseDownPicked ? math.lenVec3(math.subVec3(pickedWorldPos, this.#view.camera.eye, [])) : this.#view.camera.eyeLookDist);
                    const targetDistance = depth * Math.tan((camera.perspective.fov / 2) * Math.PI / 180.0);

                    updates.panDeltaX += (1.5 * xPanDelta * targetDistance / canvasHeight);
                    updates.panDeltaY += (1.5 * yPanDelta * targetDistance / canvasHeight);

                } else {

                    updates.panDeltaX += 0.5 * camera.ortho.scale * (xPanDelta / canvasHeight);
                    updates.panDeltaY += 0.5 * camera.ortho.scale * (yPanDelta / canvasHeight);
                }

            } else if (mouseDownLeft && !mouseDownMiddle && !mouseDownRight) {

                if (!configs.planView) { // No rotating in plan-view mode

                    if (configs.firstPerson) {
                        updates.rotateDeltaY -= ((x - lastX) / canvasWidth) * configs.dragRotationRate / 2;
                        updates.rotateDeltaX += ((y - lastY) / canvasHeight) * (configs.dragRotationRate / 4);

                    } else {
                        updates.rotateDeltaY -= ((x - lastX) / canvasWidth) * (configs.dragRotationRate * 1.5);
                        updates.rotateDeltaX += ((y - lastY) / canvasHeight) * (configs.dragRotationRate * 1.5);
                    }
                }
            }

            lastX = x;
            lastY = y;
        });

        canvas.addEventListener("mousemove", this.#canvasMouseMoveHandler = (e) => {

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

        canvas.addEventListener("mouseup", this.#mouseUpHandler = (e) => {
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
            canvas.style.removeProperty("cursor");
        });

        canvas.addEventListener("mouseenter", this.#mouseEnterHandler = () => {
            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }
            xRotateDelta = 0;
            yRotateDelta = 0;
        });

        const maxElapsed = 1 / 20;
        const minElapsed = 1 / 60;

        let secsNowLast: number = null;

        canvas.addEventListener("wheel", this.#mouseWheelHandler = (e: { deltaY: number; preventDefault: () => void; }) => {
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

            e.preventDefault();
        });
    }

    reset() {
    }

    destroy() {

        const canvas = this.#view.canvas.canvas;

        document.removeEventListener("keydown", this.#documentKeyDownHandler);
        document.removeEventListener("keyup", this.#documentKeyUpHandler);
        canvas.removeEventListener("mousedown", this.#mouseDownHandler);
        document.removeEventListener("mousemove", this.#documentMouseMoveHandler);
        canvas.removeEventListener("mousemove", this.#canvasMouseMoveHandler);
        document.removeEventListener("mouseup", this.#documentMouseUpHandler);
        canvas.removeEventListener("mouseup", this.#mouseUpHandler);
        canvas.removeEventListener("mouseenter", this.#mouseEnterHandler);
        canvas.removeEventListener("wheel", this.#mouseWheelHandler);
    }
}

export {MousePanRotateDollyHandler};
