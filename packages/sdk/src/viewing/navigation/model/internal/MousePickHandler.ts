import { createVec3Float64, subVec3} from "../../../../base/math/vector";
import type {PickResult, View} from "../../../viewer";
import {getAABB3Center} from "../../../../base/math/boundaries";
import {getSceneCollisionIndex, SceneCollisionIndex} from "../../../../spatial/collision";

/**
 * Shared scratch vector used during fly-to calculations.
 *
 * Reused to avoid per-interaction allocations on the hot path.
 */
const tempVec3a = createVec3Float64();

/**
 * Mouse interaction handler responsible for click/double-click picking,
 * pivot acquisition, and optional fly-to behavior.
 *
 * Conceptually this sits above raw DOM mouse input and below the public
 * view interaction/event surface:
 *
 * - Interprets mousedown/mouseup as click gestures
 * - Requests pick evaluation through PickController
 * - Emits picked/doublePicked semantics through modelNavigation
 * - Updates pivot state so subsequent navigation can orbit around the picked target
 *
 * This handler does *not* implement drag pan/rotate/dolly itself; that belongs
 * to the dedicated navigation handlers.
 *
 * @private
 */
class MousePickHandler {

  /**
   * Owning view. Needed for DOM binding, camera access, and teardown.
   */
  #view: View;

  /**
   * Simple click state machine:
   * - 0 => idle
   * - 1 => first click seen, waiting to see if a second click arrives within
   *        the double-click window
   */
  #clicks: number;

  /**
   * Timer used to defer single-click dispatch until we know whether the click
   * will become part of a double-click sequence.
   */
  #timeout: any;

  /**
   * Last hovered/picked entity id for hover-transition bookkeeping.
   *
   * Currently only relevant to the commented-out mousemove hover path below.
   */
  #lastPickedEntityId: any;

  /**
   * Stored listener references so destroy() can unregister reliably.
   */
  #canvasMouseDownHandler: (e) => void;
  #canvasMouseMoveHandler: (e) => void;
  #canvasMouseUpHandler: (e) => void;
  #documentMouseUpHandler: (e) => void;

  /**
   * Scene/object bounds index used for fly-to framing and scene center lookup.
   */
  #aabbIndex: SceneCollisionIndex;

  /**
   * @private
   */
  constructor(view: View, controllers: any, configs: any, states: any, updates: any) {

    this.#view = view;
    this.#aabbIndex = getSceneCollisionIndex(view.viewer.scene);

    /**
     * Central picking subsystem.
     *
     * This handler does not perform ray tests directly; it configures the pick request,
     * triggers evaluation, then consumes the resulting pick state.
     */
    const pickController = controllers.pickController;

    /**
     * Pivot/orbit subsystem.
     *
     * Mouse-pick interactions use this to establish or update the current orbit pivot
     * so navigation can remain target-centric.
     */
    const pivotController = controllers.pivotController;

    const modelNavigation = controllers.modelNavigation;

    this.#clicks = 0;
    this.#timeout = null;
    this.#lastPickedEntityId = null;

    /**
     * Button state tracking.
     *
     * Used mainly to:
     * - distinguish left-vs-right button semantics
     * - avoid invalid hover handling during active button drags
     *
     * Note that this is kept as handler-local state rather than in shared "states",
     * since it is only needed by this interaction domain.
     */
    let leftDown = false;
    let rightDown = false;

    const htmlElement = this.#view.htmlElement;

    /**
     * Helper for optional double-click fly-to.
     *
     * Current behavior:
     * - If a view object was picked, fly to its AABB.
     * - Otherwise, fly to the scene AABB.
     *
     * The `worldPos` branch appears to have been designed for a future "fly to point
     * while preserving eye->look offset" mode, but at present both branches frame bounds.
     */
    const flyCameraTo = (pickResult?: PickResult) => {
      let pos;
      if (pickResult && pickResult.worldPos) {
        pos = pickResult.worldPos
      }
      const aabb = pickResult && pickResult.viewObject
        ? this.#aabbIndex.getObjectAABB(pickResult.viewObject.id)
        : this.#aabbIndex.getSceneAABB();

      if (pos) { // Intended future path: target point-centric fly-to while preserving eye/look separation.
        const camera = view.camera;
        const diff = subVec3(camera.eye, camera.look, tempVec3a);
        controllers.cameraFlight.flyTo({
          // look: pos,
          // eye: xeokit.addVec3(pos, diff, []),
          // up: camera.up,
          aabb
        });
        // TODO: Option to back off to fit AABB in view
      } else { // Current default: frame the full bounds.
        controllers.cameraFlight.flyTo({
          aabb
        });
      }
    };

    /**
     * Hover/pick-on-move path.
     *
     * This is currently commented out, but it is worth preserving the rationale:
     *
     * - The intent was to tickify hover/picking so high-frequency mousemove events do not
     *   overwhelm the picking pipeline.
     * - It supports ray move, hover enter/leave, hover surface, and snap/surface semantics.
     * - It also maintains #lastPickedEntityId for enter/out transitions.
     *
     * For experienced SDK maintainers: this is exactly the sort of logic you want to keep
     * decoupled from click picking, because hover has very different performance and
     * throttling requirements.
     */
    // const tickifiedMouseMoveFn = view.viewer.tickify(
    //   this.#canvasMouseMoveHandler = (e) => {
    //     if (!(configs.active && configs.pointerEnabled)) {
    //       return;
    //     }
    //
    //     if (leftDown || rightDown) {
    //       return;
    //     }
    //
    //     if (modelNavigation.events.onRayMove.count > 0) {
    //       const origin = createVec3Float64();
    //       const direction = createVec3Float64();
    //       canvasPosToWorldRay(view.htmlElement, view.camera.viewMatrix, view.camera.projMatrix, view.camera.projection, states.pointerCanvasPos, origin, direction);
    //       modelNavigation.events.onRayMove.dispatch(modelNavigation, {
    //         canvasPos: states.pointerCanvasPos,
    //         ray: {
    //           origin: origin,
    //           direction: direction,
    //           canvasPos: states.pointerCanvasPos
    //         }
    //       });
    //     }
    //
    //     const hoverSubs = modelNavigation.events.onHover.count > 0;
    //     const hoverEnterSubs = modelNavigation.events.onHoverEnter.count > 0;
    //     const hoverOutSubs = modelNavigation.events.onHoverOut.count > 0;
    //     const hoverOffSubs = modelNavigation.events.onHoverOff.count > 0;
    //     const hoverSurfaceSubs = modelNavigation.events.onHoverSurface.count > 0;
    //     const hoverSnapOrSurfaceSubs = modelNavigation.events.onHoverSnapOrSurface.count > 0;
    //
    //     if (hoverSubs || hoverEnterSubs || hoverOutSubs || hoverOffSubs || hoverSurfaceSubs || hoverSnapOrSurfaceSubs) {
    //
    //       pickController.pickCursorPos = states.pointerCanvasPos;
    //       pickController.schedulePickEntity = true;
    //       pickController.schedulePick = hoverSurfaceSubs;
    //       pickController.scheduleSnapOrPick = hoverSnapOrSurfaceSubs
    //
    //       pickController.update();
    //
    //       if (pickController.pickResult) {
    //
    //         if (pickController.pickResult.viewObject) {
    //           const pickedEntityId = pickController.pickResult.viewObject.id;
    //
    //           if (this.#lastPickedEntityId !== pickedEntityId) {
    //
    //             if (this.#lastPickedEntityId !== undefined) {
    //
    //               modelNavigation.events.onHoverOut.dispatch(modelNavigation, { // Hovered off an entity
    //                 viewObject: view.objects[this.#lastPickedEntityId]
    //               });
    //             }
    //
    //             modelNavigation.events.onHoverEnter.dispatch(modelNavigation, pickController.pickResult); // Hovering over a new entity
    //
    //             this.#lastPickedEntityId = pickedEntityId;
    //           }
    //         }
    //
    //         modelNavigation.events.onHover.dispatch(modelNavigation, pickController.pickResult);
    //
    //         if (pickController.pickResult.worldPos || pickController.pickResult.snappedWorldPos) { // Hovering the surface of an entity
    //           modelNavigation.events.onHoverSurface.dispatch(modelNavigation, pickController.pickResult);
    //         }
    //
    //       } else {
    //
    //         if (this.#lastPickedEntityId !== undefined) {
    //
    //           modelNavigation.events.onHoverOut.dispatch(modelNavigation, { // Hovered off an entity
    //             viewObject: view.objects[this.#lastPickedEntityId]
    //           });
    //
    //           this.#lastPickedEntityId = undefined;
    //         }
    //
    //         modelNavigation.events.onHoverOff.dispatch(modelNavigation, { // Not hovering on any entity
    //           canvasPos: pickController.pickCursorPos
    //         });
    //       }
    //     }
    //   }
    // );
    //
    // htmlElement.addEventListener("mousemove", tickifiedMouseMoveFn);

    htmlElement.addEventListener('mousedown', this.#canvasMouseDownHandler = (e) => {

      /**
       * Track button state early, even if interaction is disabled, so internal state
       * stays consistent with the DOM button lifecycle.
       */
      if (e.which === 1) {
        leftDown = true;
      }

      if (e.which === 3) {
        rightDown = true;
      }

      const leftButtonDown = (e.which === 1);

      // This handler only uses mousedown for left-button pivot acquisition.
      if (!leftButtonDown) {
        return;
      }

      if (!(configs.active && configs.pointerEnabled)) {
        return;
      }

      /**
       * Cache both client-space and canvas-space down positions.
       *
       * Why both?
       * - clientX/clientY are later used for a cheap drag-threshold test
       * - pointerCanvasPos is the canonical interaction-space cursor position used by picking
       */
      states.mouseDownClientX = e.clientX;
      states.mouseDownClientY = e.clientY;
      states.mouseDownCursorX = states.pointerCanvasPos[0];
      states.mouseDownCursorY = states.pointerCanvasPos[1];

      /**
       * On left-button down, establish a pivot target if we are in a mode where
       * target-following orbit makes sense.
       *
       * Disabled in first-person mode because first-person rotation is eye-centric,
       * not pivot-centric.
       */
      if ((!configs.firstPerson) && configs.followPointer) {

        pickController.pickCursorPos = states.pointerCanvasPos;

        /**
         * Request a surface/world-position pick so pivot acquisition can prefer the
         * actual point under the cursor, rather than a coarse object-level target.
         */
        pickController.schedulePick = true;

        pickController.update();

        if (e.which === 1) { // Left button
          const pickResult = pickController.pickResult;

          if (pickResult && pickResult.worldPos) {
            /**
             * Best-case orbit acquisition:
             * pivot exactly on the picked world-space point under the cursor.
             */
            pivotController.setPivotPos(pickResult.worldPos);
            pivotController.startPivot();
          } else {
            /**
             * Fallback orbit acquisition:
             * - smartPivot => derive a virtual pivot from the canvas cursor position
             * - otherwise => orbit around camera.look
             */
            if (configs.smartPivot) {
              pivotController.setCanvasPivotPos(states.pointerCanvasPos);
            } else {
              pivotController.setPivotPos(view.camera.look);
            }
            pivotController.startPivot();
          }
        }
      }
    });

    document.addEventListener('mouseup', this.#documentMouseUpHandler = (e) => {

      /**
       * Track button state on document mouseup, not just canvas mouseup, so we don't get stuck
       * in a pressed state if the user releases outside the canvas.
       */
      if (e.which === 1) {
        leftDown = false;
      }

      if (e.which === 3) {
        rightDown = false;
      }

      /**
       * Any mouseup ends an active pivot acquisition session.
       *
       * This is separate from click picking: pivoting is established on mousedown,
       * but should be torn down regardless of where the button is released.
       */
      if (pivotController.getPivoting()) {
        pivotController.endPivot();
      }
    });

    htmlElement.addEventListener('mouseup', this.#canvasMouseUpHandler = (e) => {

      if (!(configs.active && configs.pointerEnabled)) {
        return;
      }

      const leftButtonUp = (e.which === 1);

      // Click/double-click picking is only driven from the left button.
      if (!leftButtonUp) {
        return;
      }

      /**
       * Hide the pivot gizmo on release.
       *
       * If a later pick/fly-to path wants to re-show it, that will happen explicitly.
       */
      pivotController.hidePivot();

      /**
       * Reject as a click if the pointer moved too far between down and up.
       *
       * This is the classic click-vs-drag disambiguation step.
       * The threshold is intentionally tiny because by the time we get here, larger
       * movement should already be treated as a navigation gesture.
       */
      if (Math.abs(e.clientX - states.mouseDownClientX) > 3 || Math.abs(e.clientY - states.mouseDownClientY) > 3) {
        return;
      }

      /**
       * Probe event subscriptions so we can avoid unnecessary pick work and avoid
       * paying the single-vs-double-click timeout when double-click semantics are not needed.
       */
      const pickedSubs = modelNavigation.events.onPicked.count > 0;
      const pickedNothingSubs = modelNavigation.events.onPickedNothing.count > 0;
      const doublePickedSubs = modelNavigation.events.onDoublePicked.count > 0;
      const doublePickedNothingSubs = modelNavigation.events.onDoublePickedNothing.count > 0;

      /**
       * Fast path: if double-click semantics are irrelevant, dispatch a single pick immediately
       * and skip the click differentiation timer entirely.
       *
       * This matters for UX responsiveness because otherwise every single click would incur
       * the double-click waiting window.
       *
       * Note: `doublePickedSurfaceSubs` is referenced here but not declared in this snippet.
       * That looks like either:
       * - an omission in the current file, or
       * - a bug introduced during refactoring.
       */
      if ((!configs.doublePickFlyTo) &&
        (!doublePickedSubs) &&
        (!doublePickedNothingSubs)) {

        if (pickedSubs || pickedNothingSubs) {

          pickController.pickCursorPos = states.pointerCanvasPos;
          pickController.schedulePick = true;
          pickController.update();

          if (pickController.pickResult) {

            modelNavigation.events.onPicked.dispatch(modelNavigation, pickController.pickResult);

            if (pickController.pickedSurface) {
              modelNavigation.events.onPickedSurface.dispatch(modelNavigation, pickController.pickResult);
            }
          } else {
            modelNavigation.events.onPickedNothing.dispatch(modelNavigation, {
              canvasPos: states.pointerCanvasPos
            });
          }
        }

        this.#clicks = 0;
        return;
      }

      /**
       * Slow path: we need to differentiate single-click from double-click.
       */
      this.#clicks++;

      if (this.#clicks === 1) { // First click

        pickController.pickCursorPos = states.pointerCanvasPos;

        /**
         * On the first click we only request the extra pick detail needed by later behavior.
         *
         * In particular, if doublePickFlyTo is enabled we want surface/world data ready in case
         * the click remains single and also for later pivot/fly semantics.
         */
        pickController.schedulePick = configs.doublePickFlyTo;
        pickController.update();

        /**
         * Snapshot the first-click result now.
         *
         * This is important because by the time the timeout fires, global pick state may have been
         * overwritten by unrelated interaction.
         */
        const firstClickPickResult = pickController.pickResult;
        const firstClickPickSurface = pickController.pickedSurface;

        /**
         * Defer single-click dispatch until the double-click window expires.
         */
        this.#timeout = setTimeout(() => {

          if (firstClickPickResult && firstClickPickResult.worldPos) {

            modelNavigation.events.onPicked.dispatch(modelNavigation, firstClickPickResult);

              /**
               * If the single click resolved on a surface and followPointer is enabled,
               * establish that point as the new orbit pivot.
               *
               * This keeps subsequent camera interaction centered on the last meaningful user target.
               */
              if ((!configs.firstPerson) && configs.followPointer) {
                controllers.pivotController.setPivotPos(firstClickPickResult.worldPos);
                if (controllers.pivotController.startPivot()) {
                  controllers.pivotController.showPivot();
                }
              }

          } else {
            modelNavigation.events.onPickedNothing.dispatch(modelNavigation, {
              canvasPos: states.pointerCanvasPos
            });
          }

          this.#clicks = 0;

        }, configs.doubleClickTimeFrame);

      } else { // Second click

        /**
         * A second click arrived in time: cancel the pending single-click dispatch and
         * resolve as a double-click.
         */
        if (this.#timeout !== null) {
          window.clearTimeout(this.#timeout);
          this.#timeout = null;
        }

        pickController.pickCursorPos = states.pointerCanvasPos;

        /**
         * Request full pick data when either:
         * - double-click subscribers need it, or
         * - fly-to-on-double-click is enabled
         */
        pickController.schedulePick = configs.doublePickFlyTo || doublePickedSubs;
        pickController.update();

        if (pickController.pickResult) {

          modelNavigation.events.onDoublePicked.dispatch(modelNavigation, pickController.pickResult);

          if (configs.doublePickFlyTo) {

            /**
             * Double-click UX: frame the picked object/scene.
             */
            flyCameraTo(pickController.pickResult);

            /**
             * After fly-to, update the orbit pivot to the picked entity center.
             *
             * Important nuance:
             * - For single-click, pivot is placed on the actual picked surface point.
             * - For double-click fly-to, pivot is moved to the entity center instead,
             *   which typically produces more stable post-flight orbit behavior.
             */
            if (pickController.pickResult.viewObject && (!configs.firstPerson) && configs.followPointer) {
              const pickResult = pickController.pickResult;
              const aabb = pickResult && pickResult.viewObject
                ? this.#aabbIndex.getObjectAABB(pickResult.viewObject.id)
                : this.#aabbIndex.getSceneAABB();
              const center = getAABB3Center(aabb);

              controllers.pivotController.setPivotPos(center);

              if (controllers.pivotController.startPivot()) {
                controllers.pivotController.showPivot();
              }
            }
          }

        } else {

          /**
           * Double-click on empty space.
           */
          modelNavigation.events.onDoublePickedNothing.dispatch(modelNavigation, {
            canvasPos: states.pointerCanvasPos
          });

          if (configs.doublePickFlyTo) {

            /**
             * Empty-space double-click frames the full scene.
             */
            flyCameraTo();

            if ((!configs.firstPerson) && configs.followPointer) {

              /**
               * After framing the scene, use the indexed scene center as the new orbit pivot.
               */
              controllers.pivotController.setPivotPos(this.#aabbIndex.getSceneCenter());

              if (controllers.pivotController.startPivot()) {
                controllers.pivotController.showPivot();
              }
            }
          }
        }

        this.#clicks = 0;
      }
    }, false);
  }

  reset() {
    /**
     * Clears in-flight click state.
     *
     * This should be called when interaction ownership changes or when the parent interaction
     * system needs to cancel pending gesture resolution.
     */
    this.#clicks = 0;
    this.#lastPickedEntityId = null;

    if (this.#timeout) {
      window.clearTimeout(this.#timeout);
      this.#timeout = null;
    }
  }

  destroy() {
    /**
     * Standard DOM listener teardown.
     *
     * Note:
     * - mousemove is removed even though the add path is currently commented out, which is harmless.
     * - clearing the timeout avoids delayed callbacks firing against a torn-down view.
     */
    const htmlElement = this.#view.htmlElement;
    htmlElement.removeEventListener("mousemove", this.#canvasMouseMoveHandler);
    htmlElement.removeEventListener("mousedown", this.#canvasMouseDownHandler);
    document.removeEventListener("mouseup", this.#documentMouseUpHandler);
    htmlElement.removeEventListener("mouseup", this.#canvasMouseUpHandler);

    if (this.#timeout) {
      window.clearTimeout(this.#timeout);
      this.#timeout = null;
    }
  }
}

export {MousePickHandler};
