/**
 * @private
 */
import {createVec2Float64, createVec3Float32, createVec3Float64, dotVec3, normalizeVec3, subVec3} from "../../base/math/vector";
import {KEY_SHIFT} from "./keycodes";
import {PerspectiveProjectionType} from "../../base/constants";
import type {View} from "../viewer";


const canvasPos = createVec2Float64();

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

  constructor(view: View, controllers: any, configs: any, states: any, updates: any) {

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
    const pickedWorldPos = createVec3Float64();
    // Snapshot of the view-direction depth at mousedown — held
    // constant for the whole drag so the per-pixel pan rate stays
    // stable. If we recomputed each move, the eye's parallel-to-view
    // translation would inflate `|pickedWorldPos - eye|` and the pan
    // would accelerate ("hydraulic" feel) the further you dragged.
    let mouseDownDepth = 0;

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
      if (!(configs.active && configs.pointerEnabled)) {
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
      pickController.schedulePick = true;
      pickController.update();

      const camera = view.camera;
      if (pickController.picked && pickController.pickResult && pickController.pickResult.worldPos) {
        mouseDownPicked = true;
        // @ts-ignore
        pickedWorldPos.set(pickController.pickResult.worldPos);
        // True depth = projection of (pickedPos - eye) onto the view
        // forward axis. Use this (not euclidean distance) so the value
        // is invariant under pans parallel to the view plane.
        const forward = normalizeVec3(
          subVec3(camera.look, camera.eye, createVec3Float32()),
          createVec3Float32());
        const offset = subVec3(pickedWorldPos, camera.eye, createVec3Float32());
        mouseDownDepth = Math.abs(dotVec3(offset, forward));
      } else {
        mouseDownPicked = false;
        mouseDownDepth = Math.abs(camera.eyeLookDist);
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

      // Scaling drag-rotate / drag-pan to canvas size.
      //
      // Read `clientWidth`/`clientHeight` from the canvas element
      // directly each frame instead of going through `view.boundary`.
      // The cached boundary is updated lazily via `ResizeObserver`
      // and `window.resize`, so it can be stale right after
      // construction (or after a layout that hasn't fired the
      // observer yet). A stale-zero value here would make the
      // per-pixel pan denominator wrong by orders of magnitude and
      // pan-drags would appear to fly the camera off into
      // hyperspace. The DOM read is cheap (no layout flush — the
      // values are already cached on the element).
      const canvasWidth = htmlElement.clientWidth || view.boundary[2] || 1;
      const canvasHeight = htmlElement.clientHeight || view.boundary[3] || 1;
      const x = states.pointerCanvasPos[0];
      const y = states.pointerCanvasPos[1];

      const panning = keyDown[KEY_SHIFT] || configs.planView || (!configs.panRightClick && mouseDownMiddle) || (configs.panRightClick && mouseDownRight);

      const xDelta = document.pointerLockElement ? e.movementX : (x - lastX);
      const yDelta = document.pointerLockElement ? e.movementY : (y - lastY);

      if (panning) {

        const camera = view.camera;

        // Ray-cast (1:1 cursor-tracking) pan.
        //
        // Apply the camera move synchronously per mousemove and zero
        // the panDelta accumulator. The accumulator + per-frame
        // `panInertia` decay in `CameraUpdater` is what made
        // shift-drag feel laggy: the camera follows the cursor with
        // a frame-by-frame easing curve instead of staying locked to
        // the picked surface point. By computing the per-pixel world
        // distance from the picked depth and applying it via
        // `camera.pan` directly, the surface under the cursor at
        // mousedown stays under the cursor at mousemove — same UX as
        // the classic CAD-viewer "grab the world and drag it" pan.

        let xPanDelta = 0;
        let yPanDelta = 0;

        if (camera.projectionType === PerspectiveProjectionType) {

          // `pixelToWorld` is the world-space distance the eye needs
          // to travel per cursor-pixel of canvas-Y movement at the
          // picked depth, derived from the perspective frustum's
          // physical extent: full-frustum height at distance `depth`
          // is `2 * depth * tan(fov/2)`, spread across `canvasHeight`
          // pixels.
          //
          // `mouseDownDepth` is the view-direction depth captured
          // ONCE at mousedown — held constant for the whole drag so
          // the rate doesn't accelerate as the eye drifts. This is
          // what makes the pan stay locked to the surface under the
          // cursor (1:1 cursor tracking) rather than running away.
          const pixelToWorld =
            (2 * mouseDownDepth * Math.tan((camera.perspectiveProjection.fov / 2) * Math.PI / 180.0))
            / canvasHeight;
          xPanDelta = xDelta * pixelToWorld;
          yPanDelta = yDelta * pixelToWorld;

        } else {

          // Ortho: visible height is exactly `orthoProjection.scale`,
          // independent of depth.
          const pixelToWorld = camera.orthoProjection.scale / canvasHeight;
          xPanDelta = xDelta * pixelToWorld;
          yPanDelta = yDelta * pixelToWorld;
        }

        // Apply directly. Camera.pan interprets the vector as
        // (left, up, forward) in the camera's local frame, so a
        // positive xPanDelta moves the camera LEFT in world (which
        // makes the content slide RIGHT to track a rightward cursor)
        // and positive yPanDelta moves the camera UP in world (which
        // makes the content slide DOWN to track a downward cursor).
        camera.pan([xPanDelta, yPanDelta, 0]);

        // Clear the accumulator + cancel any in-flight inertia so
        // the per-frame `CameraUpdater` pan stage is a no-op for
        // mouse pan. Keyboard pan still uses the accumulator path.
        updates.panDeltaX = 0;
        updates.panDeltaY = 0;
        updates.panDeltaZ = 0;

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
            controllers.viewController.events.onRightClick.dispatch(controllers.viewController, {
              pagePos: [Math.round(e.pageX), Math.round(e.pageY)],
              canvasPos: canvasPos,
              event: e
            });
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
      let secsElapsed = (secsNowLast !== null) ? (secsNow - secsNowLast) : 0;
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


