import {createVec2Float64, createVec3Float32, distVec2, geometricMeanVec2, lenVec3, subVec2, subVec3} from "../../base/math/vector";
import {PerspectiveProjectionType} from "../../base/constants";
import type {View} from "../viewer";
import {getSceneCollisionIndex, SceneCollisionIndex} from "../../spatial/collision";

const getCanvasPosFromEvent = function (event, canvasPos) {
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
  #aabbIndex: SceneCollisionIndex;

  constructor(view: View, controllers: any, configs: any, states: any, updates: any) {

    this.#view = view;
    this.#aabbIndex = getSceneCollisionIndex(view.viewer.scene);

    const pickController = controllers.pickController;
    const pivotController = controllers.pivotController;

    const tapStartCanvasPos = createVec2Float64();
    const tapCanvasPos0 = createVec2Float64();
    const tapCanvasPos1 = createVec2Float64();
    const touch0Vec = createVec2Float64();

    const lastCanvasTouchPosList = [];
    const canvas = this.#view.htmlElement;

    let numTouches = 0;
    let tapStartTime = -1;

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
          pickController.schedulePick = true;
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
        lastCanvasTouchPosList.push(createVec2Float64());
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

      // Scaling drag-rotate / drag-pan to canvas size — read live
      // from the element so a stale `view.boundary` (lazy-updated
      // via ResizeObserver) can't blow the per-pixel denominator
      // up. Same defensive pattern the mouse pan handler uses.
      const htmlElement = view.htmlElement;
      const canvasWidth = htmlElement.clientWidth || view.boundary[2] || 1;
      const canvasHeight = htmlElement.clientHeight || view.boundary[3] || 1;

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
            const pickedWorldPos = createVec3Float32([0, 0, 0]);

            const depth = Math.abs(touchPicked ? lenVec3(subVec3(pickedWorldPos, view.camera.eye, createVec3Float32())) : view.camera.eyeLookDist);
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
        const currentMiddleTouch = geometricMeanVec2(<any>tapCanvasPos0, <any>tapCanvasPos1);

        const touchDelta = createVec2Float64();

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
            const pickedWorldPos = pickController.pickResult ? pickController.pickResult.worldPos : this.#aabbIndex.getSceneCenter();

            const depth = Math.abs(lenVec3(subVec3(pickedWorldPos, view.camera.eye, createVec3Float32())));
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
  }
}

export {TouchPanRotateAndDollyHandler};
