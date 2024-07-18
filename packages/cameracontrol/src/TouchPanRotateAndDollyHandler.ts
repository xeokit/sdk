
import {createVec2, distVec2, geometricMeanVec2, lenVec3, subVec2, subVec3} from "@xeokit/matrix";
import {View} from "@xeokit/viewer";
import {PerspectiveProjectionType} from "@xeokit/constants";

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
class TouchPanRotateAndDollyHandler {
    #canvasTouchMoveHandler: any;
    #canvasTouchStartHandler: any;
    #view: View;
    #canvasTouchEndHandler: any;
    #tickSub: () => void;

    constructor(view:View, controllers:any, configs:any, states:any, updates:any) {

        this.#view = view;

        const pickController = controllers.pickController;
        const pivotController = controllers.pivotController;

        const tapStartCanvasPos = createVec2();
        const tapCanvasPos0 = createVec2();
        const tapCanvasPos1 = createVec2();
        const touch0Vec = createVec2();

        const lastCanvasTouchPosList = [];
        const canvas = this.#view.htmlElement;

        let numTouches = 0;
        let tapStartTime = -1;
        let waitForTick = false;

        this.#tickSub = view.viewer.onTick.sub(() => {
            waitForTick = false;
        });

        let firstDragDeltaX = 0;
        let firstDragDeltaY = 1;
        let absorbTinyFirstDrag = false;

        canvas.addEventListener("touchstart", this.#canvasTouchStartHandler = (event) => {

            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }

            event.preventDefault();

            const touches = event.touches;
            const changedTouches = event.changedTouches;

            states.touchStartTime = Date.now();

            if (touches.length === 1 && changedTouches.length === 1) {

                tapStartTime = states.touchStartTime;

                getCanvasPosFromEvent(touches[0], tapStartCanvasPos);

                if (configs.followPointer) {

                    pickController.pickCursorPos = tapStartCanvasPos;
                    pickController.schedulePickSurface = true;
                    pickController.update();

                    if (!configs.planView) {

                        if (pickController.picked && pickController.pickedSurface && pickController.pickResult && pickController.pickResult.worldPos) {

                            pivotController.setPivotPos(pickController.pickResult.worldPos);

                            if (!configs.firstPerson && pivotController.startPivot()) {
                                pivotController.showPivot();
                            }

                        } else {

                            if (configs.smartPivot) {
                                pivotController.setCanvasPivotPos(states.pointerCanvasPos);
                            } else {
                                pivotController.setPivotPos(view.camera.look);
                            }

                            if (!configs.firstPerson && pivotController.startPivot()) {
                                pivotController.showPivot();
                            }
                        }
                    }
                }

            } else {
                tapStartTime = -1;
            }

            while (lastCanvasTouchPosList.length < touches.length) {
                lastCanvasTouchPosList.push(createVec2());
            }

            for (let i = 0, len = touches.length; i < len; ++i) {
                getCanvasPosFromEvent(touches[i], lastCanvasTouchPosList[i]);
            }

            numTouches = touches.length;
        });

        canvas.addEventListener("touchend", this.#canvasTouchEndHandler = () => {
            if (pivotController.getPivoting()) {
                pivotController.endPivot()
            }
            firstDragDeltaX = 0;
            firstDragDeltaY = 0;
            absorbTinyFirstDrag = true;
        })

        canvas.addEventListener("touchmove", this.#canvasTouchMoveHandler = (event) => {

            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }

            event.stopPropagation();
            event.preventDefault();

            if (waitForTick) {
                // Limit changes detection to one per frame
                return;
            }

            waitForTick = true;

            // Scaling drag-rotate to canvas boundary

            const canvasBoundary = view.boundary;
            const canvasWidth = canvasBoundary[2];
            const canvasHeight = canvasBoundary[3];

            const touches = event.touches;

            if (event.touches.length !== numTouches) {
                // Two fingers were pressed, then one of them is removed
                // We don't want to rotate in this case (weird behavior)
                return;
            }

            if (numTouches === 1) {

                getCanvasPosFromEvent(touches[0], tapCanvasPos0);

                //-----------------------------------------------------------------------------------------------
                // Drag rotation
                //-----------------------------------------------------------------------------------------------

                subVec2(tapCanvasPos0, lastCanvasTouchPosList[0], touch0Vec);

                const xPanDelta = touch0Vec[0];
                const yPanDelta = touch0Vec[1];

                if (states.longTouchTimeout !== null && (Math.abs(xPanDelta) > configs.longTapRadius || Math.abs(yPanDelta) > configs.longTapRadius)) {
                    clearTimeout(states.longTouchTimeout);
                    states.longTouchTimeout = null;
                }

                if (configs.planView) { // No rotating in plan-view mode

                    const camera = view.camera;

                    // We use only canvasHeight here so that aspect ratio does not distort speed

                    if (camera.projectionType === PerspectiveProjectionType) {

                        const touchPicked = false;
                        const pickedWorldPos = [0, 0, 0];

                        const depth = Math.abs(touchPicked ? lenVec3(subVec3(pickedWorldPos, view.camera.eye, [])) : view.camera.eyeLookDist);
                        const targetDistance = depth * Math.tan((camera.perspectiveProjection.fov / 2) * Math.PI / 180.0);

                        updates.panDeltaX += (xPanDelta * targetDistance / canvasHeight) * configs.touchPanRate;
                        updates.panDeltaY += (yPanDelta * targetDistance / canvasHeight) * configs.touchPanRate;

                    } else {

                        updates.panDeltaX += 0.5 * camera.orthoProjection.scale * (xPanDelta / canvasHeight) * configs.touchPanRate;
                        updates.panDeltaY += 0.5 * camera.orthoProjection.scale * (yPanDelta / canvasHeight) * configs.touchPanRate;
                    }

                } else {
                  //  if (!absorbTinyFirstDrag) {
                        updates.rotateDeltaY -= (xPanDelta / canvasWidth) * (configs.dragRotationRate * 1.0); // Full horizontal rotation
                        updates.rotateDeltaX += (yPanDelta / canvasHeight) * (configs.dragRotationRate * 1.5); // Half vertical rotation
                    // } else {
                    //     firstDragDeltaY -= (xPanDelta / canvasWidth) * (configs.dragRotationRate * 1.0); // Full horizontal rotation
                    //     firstDragDeltaX += (yPanDelta / canvasHeight) * (configs.dragRotationRate * 1.5); // Half vertical rotation
                    //     if (Math.abs(firstDragDeltaX) > 5 || Math.abs(firstDragDeltaY) > 5) {
                    //         updates.rotateDeltaX += firstDragDeltaX;
                    //         updates.rotateDeltaY += firstDragDeltaY;
                    //         firstDragDeltaX = 0;
                    //         firstDragDeltaY = 0;
                    //         absorbTinyFirstDrag = false;
                    //     }
                    // }
                }

            } else if (numTouches === 2) {

                const touch0 = touches[0];
                const touch1 = touches[1];

                getCanvasPosFromEvent(touch0, tapCanvasPos0);
                getCanvasPosFromEvent(touch1, tapCanvasPos1);

                const lastMiddleTouch = geometricMeanVec2(lastCanvasTouchPosList[0], lastCanvasTouchPosList[1]);
                const currentMiddleTouch = geometricMeanVec2(tapCanvasPos0, tapCanvasPos1);

                const touchDelta = createVec2();

                subVec2(lastMiddleTouch, currentMiddleTouch, touchDelta);

                const xPanDelta = touchDelta[0];
                const yPanDelta = touchDelta[1];

                const camera = view.camera;

                // Dollying

                const d1 = distVec2([touch0.pageX, touch0.pageY], [touch1.pageX, touch1.pageY]);
                const d2 = distVec2(lastCanvasTouchPosList[0], lastCanvasTouchPosList[1]);

                const dollyDelta = (d2 - d1) * configs.touchDollyRate;

                updates.dollyDelta = dollyDelta;

                if (Math.abs(dollyDelta) < 1.0) {

                    // We use only canvasHeight here so that aspect ratio does not distort speed

                    if (camera.projectionType === PerspectiveProjectionType) {
                        const pickedWorldPos = pickController.pickResult ? pickController.pickResult.worldPos : view.viewer.scene.center;

                        const depth = Math.abs(lenVec3(subVec3(pickedWorldPos, view.camera.eye, [])));
                        const targetDistance = depth * Math.tan((camera.perspectiveProjection.fov / 2) * Math.PI / 180.0);

                        updates.panDeltaX -= (xPanDelta * targetDistance / canvasHeight) * configs.touchPanRate;
                        updates.panDeltaY -= (yPanDelta * targetDistance / canvasHeight) * configs.touchPanRate;

                    } else {

                        updates.panDeltaX -= 0.5 * camera.orthoProjection.scale * (xPanDelta / canvasHeight) * configs.touchPanRate;
                        updates.panDeltaY -= 0.5 * camera.orthoProjection.scale * (yPanDelta / canvasHeight) * configs.touchPanRate;
                    }
                }


                states.pointerCanvasPos = currentMiddleTouch;
            }

            for (let i = 0; i < numTouches; ++i) {
                getCanvasPosFromEvent(touches[i], lastCanvasTouchPosList[i]);
            }
        });
    }

    reset() {
    }

    destroy() {
        const canvas = this.#view.htmlElement;
        canvas.removeEventListener("touchstart", this.#canvasTouchStartHandler);
        canvas.removeEventListener("touchend", this.#canvasTouchEndHandler);
        canvas.removeEventListener("touchmove", this.#canvasTouchMoveHandler);
        this.#view.viewer.onTick.unsub(this.#tickSub);
    }
}

export {TouchPanRotateAndDollyHandler};
