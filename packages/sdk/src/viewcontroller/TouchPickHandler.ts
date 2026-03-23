import {createVec2Float32, distVec2, subVec3} from "../math/vector";
import type {PickResult, View} from "../viewer";
import {getSceneAABB3Index, SceneAABB3Index} from "../collision/aabb/SceneAABB3Index";

/**
 * Maximum press duration that still qualifies as a tap.
 *
 * Anything longer is treated as either a long-press candidate or general touch interaction,
 * rather than a discrete "pick" gesture.
 */
const TAP_INTERVAL = 150;

/**
 * Maximum interval between two taps for them to be interpreted as a double-tap.
 *
 * This is intentionally larger than TAP_INTERVAL so we can keep single-tap latency low
 * while still allowing a comfortable second tap window.
 */
const DBL_TAP_INTERVAL = 325;

/**
 * Maximum pointer drift allowed between touchstart and touchend for the gesture to still
 * be classified as a tap.
 *
 * This filters out short drags/pans that would otherwise generate accidental picks.
 */
const TAP_DISTANCE_THRESHOLD = 4;

/**
 * Converts a DOM pointer/touch event into canvas-local coordinates.
 *
 * Notes for SDK maintainers:
 * - This is using a classic offsetParent walk instead of getBoundingClientRect().
 * - That makes it work with page-space coordinates, but also means behavior depends on the
 *   DOM layout model and scroll handling.
 * - If the canvas can be CSS-transformed, nested in scrolled containers, or rendered at a
 *   different devicePixelRatio than CSS pixels, this may need to be revisited.
 *
 * @param event Touch/mouse-like DOM event.
 * @param canvasPos Reusable output vec2.
 * @returns canvasPos for chaining/reuse.
 */
const getCanvasPosFromEvent = function (event, canvasPos) {
  if (!event) {
    // Legacy fallback path. Preserved for compatibility with older event models.
    event = window.event;
    canvasPos[0] = event.x;
    canvasPos[1] = event.y;
  } else {
    let element = event.target;
    let totalOffsetLeft = 0;
    let totalOffsetTop = 0;

    // Accumulate element offsets to map page coordinates into element-local coordinates.
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
 * Touch gesture handler responsible for translating touch interactions into view picking events.
 *
 * Responsibilities:
 * - Detect single-tap and double-tap gestures.
 * - Detect long-press and surface it as a synthetic "rightClick" for mobile context-menu flows.
 * - Drive picking through PickController using the final touch position.
 * - Optionally trigger camera fly-to on double-tap.
 *
 * Non-responsibilities:
 * - Does not handle touch pan/rotate/dolly navigation. That belongs in the navigation handler.
 * - Does not perform picking directly; it schedules/configures PickController and consumes the result.
 *
 * Design intent:
 * This handler sits at the gesture interpretation layer. It converts low-level touch events into
 * higher-level semantic view events such as "picked", "doublePicked", and "rightClick".
 *
 * @private
 */
export class TouchPickHandler {

  /**
   * Owning view. Needed for DOM event binding and camera access.
   */
  #view: View;

  /**
   * Stored listener references so destroy() can reliably unregister them.
   */
  #canvasTouchStartHandler: (e) => void;
  #canvasTouchEndHandler: (e) => void;

  /**
   * Spatial index used to retrieve object or scene bounds for fly-to behavior.
   *
   * Important: this avoids reconstructing bounds from render data at gesture time.
   */
  #aabbIndex: SceneAABB3Index;

  constructor(view: View, controllers: any, configs: any, states: any, updates: any) {

    this.#view = view;
    this.#aabbIndex = getSceneAABB3Index(view.viewer.scene);

    /**
     * Centralized picking subsystem. This handler only configures it and triggers evaluation.
     */
    const pickController = controllers.pickController;

    /**
     * Top-level interaction/event surface. Used to fire semantic events outward.
     */
    const viewController = controllers.viewController;

    /**
     * Timestamp of the most recent touchstart for the current gesture.
     */
    let touchStartTime;

    /**
     * Scratch storage for current active touch positions.
     *
     * Reused across events to avoid per-frame/per-event allocations.
     * Each entry is a vec2 in canvas/page space depending on where it was written.
     */
    const activeTouches = [];

    /**
     * Position where the current tap candidate began.
     *
     * Used to reject gestures that drift too far and should therefore be interpreted as
     * navigation rather than picking.
     */
    const tapStartPos = createVec2Float32();

    /**
     * Timestamp at which the current tap candidate began.
     * -1 means there is no active tap candidate.
     */
    let tapStartTime = -1;

    /**
     * Timestamp of the previously accepted single tap.
     *
     * Used for double-tap detection.
     */
    let lastTapTime = -1;

    const htmlElement = this.#view.htmlElement;

    /**
     * Utility for double-tap fly-to behavior.
     *
     * Behavior:
     * - If a pick hit exists, fly to the picked object's AABB.
     * - If no object was hit, fly to the scene AABB.
     *
     * Note:
     * The `worldPos` branch looks like it was intended to support point-centric fly-to
     * while preserving eye->look distance, but currently both branches resolve to flying
     * to the AABB. That makes this function effectively "fit target bounds".
     */
    const flyCameraTo = (pickResult?: PickResult) => {
      let pos;
      if (pickResult && pickResult.worldPos) {
        pos = pickResult.worldPos
      }

      const aabb = pickResult && pickResult.viewObject
        ? this.#aabbIndex.getObjectAABB(pickResult.viewObject.id)
        : this.#aabbIndex.getSceneAABB();

      if (pos) { // Intended future path: fly to picked point without changing eye->look distance.
        const camera = view.camera;
        // const diff = subVec3(camera.eye, camera.look, []);
        controllers.cameraFlight.flyTo({
          aabb
        });
        // TODO: Option to back off to fit AABB in view.
      } else { // Current default: frame the target bounds.
        controllers.cameraFlight.flyTo({
          aabb
        });
      }
    };

    htmlElement.addEventListener("touchstart", this.#canvasTouchStartHandler = (e) => {

      // Ignore interaction when the overall interaction system is disabled.
      if (!(configs.active && configs.pointerEnabled)) {
        return;
      }

      // Any new touchstart cancels a pending long-press timer from the previous gesture state.
      if (states.longTouchTimeout !== null) {
        clearTimeout(states.longTouchTimeout);
        states.longTouchTimeout = null;
      }

      const touches = e.touches;
      const changedTouches = e.changedTouches;

      touchStartTime = Date.now();

      /**
       * A touchstart with exactly one active touch and exactly one changed touch is treated
       * as a potential tap/long-press candidate.
       *
       * Multi-touch immediately disqualifies tap interpretation, because the gesture is
       * almost certainly intended for navigation (pinch/pan/etc.).
       */
      if (touches.length === 1 && changedTouches.length === 1) {
        tapStartTime = touchStartTime;

        // Capture the gesture origin in canvas-local space for tap-distance testing.
        getCanvasPosFromEvent(touches[0], tapStartPos);

        const rightClickClientX = tapStartPos[0];
        const rightClickClientY = tapStartPos[1];

        // Preserve page-space coordinates as well since context menus often need absolute page placement.
        const rightClickPageX = touches[0].pageX;
        const rightClickPageY = touches[0].pageY;

        /**
         * Long-press is exposed as a synthetic right-click.
         *
         * This is a common mobile affordance for opening context actions in a 3D view.
         * The timer is cancelled on touchend or on any subsequent touchstart state change.
         */
        states.longTouchTimeout = setTimeout(() => {
          controllers.viewController.fire("rightClick", {
            pagePos: [Math.round(rightClickPageX), Math.round(rightClickPageY)],
            canvasPos: [Math.round(rightClickClientX), Math.round(rightClickClientY)],
            event: e
          }, true);

          states.longTouchTimeout = null;
        }, configs.longTapTimeout);

      } else {
        // Multi-touch or ambiguous gesture: do not allow it to resolve as a tap.
        tapStartTime = -1;
      }

      /**
       * Ensure the activeTouches scratch array has enough vec2 slots for all active touches.
       * We reuse Float32Arrays to avoid allocations during high-frequency input.
       */
      while (activeTouches.length < touches.length) {
        activeTouches.push(new Float32Array(2))
      }

      // Snapshot current touch positions in canvas-local coordinates.
      for (let i = 0, len = touches.length; i < len; ++i) {
        getCanvasPosFromEvent(touches[i], activeTouches[i]);
      }

      activeTouches.length = touches.length;

    }, {passive: true});


    htmlElement.addEventListener("touchend", this.#canvasTouchEndHandler = (e) => {

      // Ignore interaction when the overall interaction system is disabled.
      if (!(configs.active && configs.pointerEnabled)) {
        return;
      }

      const currentTime = Date.now();
      const touches = e.touches;
      const changedTouches = e.changedTouches;

      /**
       * We only schedule surface picking if there are listeners for it.
       *
       * This is an important optimization: precise surface picks can be more expensive than
       * entity/object picks, so we only request them when the result will actually be consumed.
       */
      const pickedSurfaceSubs = viewController.hasSubs("pickedSurface");

      // Any completed touch gesture cancels the pending long-press timer.
      if (states.longTouchTimeout !== null) {
        clearTimeout(states.longTouchTimeout);
        states.longTouchTimeout = null;
      }

      // Process tap resolution only when the gesture ended with a single released touch
      // and no remaining active touches.
      if (touches.length === 0 && changedTouches.length === 1) {

        // Gesture must have started as a valid tap candidate and ended quickly enough.
        if (tapStartTime > -1 && currentTime - tapStartTime < TAP_INTERVAL) {

          /**
           * Double-tap path:
           * If the prior accepted tap occurred recently enough, resolve this gesture as a double-tap.
           */
          if (lastTapTime > -1 && tapStartTime - lastTapTime < DBL_TAP_INTERVAL) {

            getCanvasPosFromEvent(changedTouches[0], pickController.pickCursorPos);

            // Always request entity/object picking for tap gestures.
            pickController.schedulePick = true;

            // Resolve the scheduled pick immediately against the current cursor position.
            pickController.update();

            if (pickController.pickResult) {

              // Mark the origin of the gesture so downstream consumers can distinguish touch vs mouse picks.
              pickController.pickResult.touchInput = true;

              // Fire semantic double-pick event on the top-level interaction surface.
              viewController.fire("doublePicked", pickController.pickResult);

              // Surface-level hit event is emitted separately when requested/available.
              if (pickController.pickedSurface) {
                viewController.fire("doublePickedSurface", pickController.pickResult);
              }

              // Optional UX behavior: frame the picked object after double-tap.
              if (configs.doublePickFlyTo) {
                flyCameraTo(pickController.pickResult);
              }
            } else {
              // Double-tap on empty space.
              viewController.fire("doublePickedNothing");

              // Optional UX behavior: frame the whole scene on empty double-tap.
              if (configs.doublePickFlyTo) {
                flyCameraTo();
              }
            }

            // Consumed as double-tap; clear tap history.
            lastTapTime = -1;

          } else if (distVec2(activeTouches[0], tapStartPos) < TAP_DISTANCE_THRESHOLD) {

            /**
             * Single-tap path:
             * We only accept it if the touch did not drift beyond the tap threshold.
             *
             * This is the key disambiguation step between picking and touch-based navigation.
             */
            getCanvasPosFromEvent(changedTouches[0], pickController.pickCursorPos);
            pickController.schedulePick = true;

            pickController.update();

            if (pickController.pickResult) {

              pickController.pickResult.touchInput = true;

              // Object/entity pick.
              viewController.fire("picked", pickController.pickResult);

              // Optional precise surface pick.
              if (pickController.pickedSurface) {
                viewController.fire("pickedSurface", pickController.pickResult);
              }

            } else {
              // Tap on empty space.
              viewController.fire("pickedNothing");
            }

            // Record this tap so a subsequent tap can resolve as double-tap.
            lastTapTime = currentTime;
          }

          // Gesture has been resolved; clear the active tap candidate.
          tapStartTime = -1
        }
      }

      /**
       * Update the active touch snapshot after touchend.
       */
      activeTouches.length = touches.length;

      for (let i = 0, len = touches.length; i < len; ++i) {
        activeTouches[i][0] = touches[i].pageX;
        activeTouches[i][1] = touches[i].pageY;
      }

      // Intentionally passive: we do not preventDefault or stopPropagation here.

    }, {passive: true});

  }

  reset(): void {
    /**
     * Placeholder for explicit gesture-state reset.
     *
     * This would be useful if the parent interaction system needs to forcibly cancel
     * gesture recognition when modes change, the view loses focus, or input ownership
     * is transferred to another interaction subsystem.
     */
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
