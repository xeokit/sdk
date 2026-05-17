import type {View} from "../viewer";
import {PickResult} from "../viewer";
import type {ViewController} from "./ViewController";
import {createVec2Float64} from "../../base/math/vector";

const DEFAULT_SNAP_PICK_RADIUS = 45;
const DEFAULT_SNAP_MODE = "vertex";

/**
 * Picking/hover state machine used by the higher-level interaction handlers.
 *
 * This controller is intentionally narrow in scope:
 * - it stores pending pick requests
 * - it coalesces/reuses pick work
 * - it translates pick results into hover/snap-related events
 *
 * It does *not* own the DOM event lifecycle itself. Mouse/touch handlers write
 * scheduling state into this controller, call update(), then optionally call
 * fireEvents() when they want the resulting semantic events emitted.
 *
 * Architecturally this is a good separation:
 * - input handlers decide *when* a pick should happen
 * - PickController decides *what kind* of pick to perform and *which events*
 *   should result from it
 *
 * @private
 */
class PickController {
  /**
   * Owning view. Needed for object lookup during hover transition events.
   */
  #view: View;

  #viewController: ViewController;

  /**
   * Shared runtime config owned by the top-level interaction system.
   *
   * Relevant values here include:
   * - pointerEnabled
   * - snapRadius
   * - snapToVertex
   * - snapToEdge
   */
  #configs: any;

  /**
   * When true, a surface/entity pick should be performed on the next update().
   *
   * Despite the name, this is really "pick on next evaluation pass", not a persistent mode.
   */
  private schedulePick: boolean;

  /**
   * When true, attempt snap-picking first, and fall back to regular picking if
   * nothing snap-worthy is found.
   *
   * This is the right abstraction for measurement/precision tools, where a snapped
   * edge/vertex is preferred over a generic surface hit.
   */
  private scheduleSnapOrPick: boolean;

  /**
   * Canvas-space cursor position for the next scheduled evaluation.
   *
   * This is mutated by input handlers before they call update().
   */
  private pickCursorPos: any;

  /**
   * Becomes true after update() if a regular pick hit is considered valid for event emission.
   */
  private picked: boolean;

  /**
   * Holds the most recent regular pick result.
   *
   * Important: in the code as shown, update() never actually assigns a new value to this.
   * That strongly suggests either:
   * - this snippet is incomplete, or
   * - there is a regression/refactor bug.
   *
   * The surrounding logic clearly expects pickResult to hold the latest surface/entity hit.
   */
  private pickResult: PickResult;

  /**
   * Last hovered entity id, used to synthesize hover enter/hover out transitions.
   */
  #lastPickedEntityId: any;

  /**
   * Hash of the last evaluated request.
   *
   * Used to suppress duplicate evaluations when the pointer position and request
   * type have not changed.
   */
  #lastHash: any;

  /**
   * Small event budget/counter used to indicate that fireEvents() has meaningful work to do.
   *
   * This lets update() remain cheap when nothing changed and avoids redundant event churn.
   */
  #needFireEvents: number;

  /**
   * True when either a snap result or a regular pick result should feed the
   * "hoverSnapOrSurface" event stream.
   */
  private snappedOrPicked: boolean;

  /**
   * True when the previous hover state was snap-or-surface and the current evaluation
   * indicates that state should be turned off.
   *
   * This is used to emit onHoverSnapOrSurfaceOff exactly when the system transitions
   * out of that state.
   */
  private hoveredSnappedOrSurfaceOff: boolean;

  /**
   * Most recent snap-pick result, when snapping succeeded.
   *
   * Kept separate from pickResult because snap and regular pick can have slightly
   * different semantics and payload shaping.
   */
  private snapPickResult: PickResult;

  /**
   * True when the most recent pick hit a surface (i.e. pick result has a worldPos).
   */
  get pickedSurface(): boolean {
    return this.picked && this.pickResult != null && this.pickResult.worldPos != null;
  }

  constructor(viewController: ViewController, configs: any) {

    this.#view = viewController.view;

    this.#viewController = viewController;

    /**
     * Prevent the browser's native context menu from hijacking the interaction surface.
     *
     * This is especially important in 3D viewers where right click / long press are
     * typically mapped to navigation or custom interaction affordances.
     */
    this.#view.htmlElement.oncontextmenu = function (e) {
      e.preventDefault();
    };

    this.#configs = configs;

    /**
     * Set true to schedule a regular pick on the next update().
     *
     * Historically this comment says "surface of an Entity", but in practice the downstream
     * event logic treats the result as both:
     * - object/entity hover state
     * - optional surface/world-position hover state
     */
    this.schedulePick = false;

    /**
     * Set true to schedule snap-picking with regular picking as a fallback.
     *
     * Used for workflows that prefer exact topological targets such as:
     * - vertex snap
     * - edge snap
     * - otherwise nearest surface hit
     */
    this.scheduleSnapOrPick = false;

    /**
     * Canvas position for the next scheduled evaluation.
     *
     * Reused in-place to avoid allocations on pointer move.
     */
    this.pickCursorPos = createVec2Float64();

    /**
     * True when the current evaluation produced a valid regular pick hit.
     */
    this.picked = false;

    /**
     * Most recent regular pick result.
     */
    this.pickResult = null;

    this.#lastPickedEntityId = null;
    this.#lastHash = null;
    this.#needFireEvents = 0;
  }

  /**
   * Executes any scheduled pick work immediately.
   *
   * Key design points:
   * - No-op if pointer interaction is disabled.
   * - No-op if nothing has been scheduled.
   * - Suppresses duplicate work using a simple request hash.
   * - Supports snap-first / pick-second evaluation.
   *
   * This method is deliberately separated from fireEvents():
   * update() computes state, fireEvents() publishes it.
   *
   * That separation is useful when the caller wants tight control over *when* event
   * emission happens relative to the rest of the frame/update pipeline.
   */
  update() {

    if (!this.#configs.pointerEnabled) {
      return;
    }

    if (!this.schedulePick) {
      return;
    }

    if (!this.#viewController.pick) {
      console.warn("[PickController.update] No pick implementation found on ViewController.");
      this.schedulePick = false;
      this.scheduleSnapOrPick = false;
      return;
    }

    /**
     * Coarse request deduplication.
     *
     * We quantize the cursor position to integer pixels and include the active evaluation
     * modes in the hash. If nothing relevant changed, we skip the work.
     *
     * Caveat:
     * The current implementation never writes back to #lastHash, so deduplication as shown
     * will not actually take effect. That looks like an omission/bug.
     */
    const hash = `${~~this.pickCursorPos[0]}-${~~this.pickCursorPos[1]}-${this.scheduleSnapOrPick}-${this.schedulePick}`;
    if (this.#lastHash === hash) {
      return;
    }
    this.#lastHash = hash;

    /**
     * Reset per-evaluation transient state.
     */
    this.picked = false;
    this.snappedOrPicked = false;
    this.hoveredSnappedOrSurfaceOff = false;

    const hasHoverSurfaceSubs = this.#viewController.events.onHover.count > 0;

    if (this.scheduleSnapOrPick || this.schedulePick) {

      // Snap is requested only when the consumer asked for it
      // (`scheduleSnapOrPick`). A bare `schedulePick` — used by the
      // pivot-acquisition path among others — wants the actual
      // surface point under the cursor, not a snap-target nearby:
      // pivoting around a snapped vertex makes the camera orbit
      // around a point that isn't where the user clicked. Forwarding
      // the global `snapToVertex` / `snapToEdge` config here without
      // gating on `scheduleSnapOrPick` is what made every pivot pick
      // snap when those configs were on (default `true`).
      const result = this.#viewController.pick(this.#viewController.view,{
        canvasPos:    this.pickCursorPos,
        snapRadius:   this.scheduleSnapOrPick ? this.#configs.snapRadius   : undefined,
        snapToVertex: this.scheduleSnapOrPick && this.#configs.snapToVertex,
        snapToEdge:   this.scheduleSnapOrPick && this.#configs.snapToEdge,
      });

      if (result.ok !== true) {
        console.error("[PickController.update] Pick failed with error:", result.error);
        this.schedulePick = true;
        this.snapPickResult = null;
        this.scheduleSnapOrPick = false;
        return;
      } else {

        const snapPickResult = result.value;

        if (snapPickResult) {
          if (snapPickResult.snappedToEdge || snapPickResult.snappedToVertex) {

            this.snapPickResult = snapPickResult;
            this.snappedOrPicked = true;
            this.#needFireEvents++;

          } else {
            this.schedulePick = true;
            this.pickResult = snapPickResult;
            //   this.snapPickResult = snapPickResult;
          }
        }
      }
    }

    if (this.schedulePick) {
      if (this.pickResult && this.pickResult.worldPos) {
        const pickResultCanvasPos = this.pickResult.canvasPos;
        if (pickResultCanvasPos[0] === this.pickCursorPos[0] && pickResultCanvasPos[1] === this.pickCursorPos[1]) {
          this.picked = true;
          this.#needFireEvents++;
          this.schedulePick = false;
          if (this.scheduleSnapOrPick) {
            this.snappedOrPicked = true;
          } else {
            this.hoveredSnappedOrSurfaceOff = true;
          }
          this.scheduleSnapOrPick = false;
          return;
        }
      }

      this.scheduleSnapOrPick = false;
      this.schedulePick = false;
    }

    /**
     * Clear one-shot scheduling flags.
     *
     * At this point either:
     * - the request was handled,
     * - it fell through without a hit (empty space — fireEvents will emit hoverOff),
     * - or the actual regular-pick path is expected to be filled in elsewhere.
     */
    this.#needFireEvents++;
    this.scheduleSnapOrPick = false;
    this.schedulePick = false;
  }

  /**
   * Emits any semantic hover/snap events implied by the most recent update().
   *
   * Event families handled here:
   * - hoverSnapOrSurfaceOff
   * - hoverSnapOrSurface
   * - hoverEnter / hoverOut
   * - hover
   * - hoverOff
   *
   * This function is effectively the publication phase of the controller's state machine.
   */
  fireEvents() {

    if (this.#needFireEvents === 0) {
      return;
    }

    const events = this.#viewController.events;

    /**
     * Emit transition out of snap/surface-hover state.
     */
    if (this.hoveredSnappedOrSurfaceOff) {
      this.#viewController.events.onHoverSnapOrSurfaceOff.dispatch(this.#viewController, {
        canvasPos: this.pickCursorPos,
        pointerPos: this.pickCursorPos
      });
    }

    /**
     * Emit "hovering a snapped target or surface target" event.
     *
     * If snapping succeeded, we synthesize a fresh PickResult so the payload has the
     * canonical shape expected by subscribers.
     */
    if (this.snappedOrPicked) {
      if (this.snapPickResult) {
        const pickResult = new PickResult();
        pickResult.viewObject = this.snapPickResult.viewObject;
        pickResult.snappedToVertex = this.snapPickResult.snappedToVertex;
        pickResult.snappedToEdge = this.snapPickResult.snappedToEdge;
        pickResult.worldPos = this.snapPickResult.worldPos;
        pickResult.canvasPos = this.pickCursorPos;
        pickResult.snappedCanvasPos = this.snapPickResult.snappedCanvasPos;

        events.onHoverSnapOrSurface.dispatch(this.#viewController, pickResult);
        this.snapPickResult = null;
      } else {
        /**
         * No dedicated snap payload, so publish the regular pick result as the
         * "snap or surface" payload.
         */
        events.onHoverSnapOrSurface.dispatch(this.#viewController, this.pickResult);
      }
    } else {
      /**
       * No-op else branch.
       *
       * This is a reasonable cleanup candidate unless you expect additional event
       * families to be added here soon.
       */
    }

    /**
     * Hover lifecycle for regular object/entity hits.
     *
     * This block synthesizes:
     * - hoverEnter when entity identity changes
     * - hoverOut when leaving a previously hovered entity
     * - hover while over a valid target
     * - hoverOff when over empty space
     */
    if (this.picked && this.pickResult && (this.pickResult.viewObject || this.pickResult.worldPos)) {

      if (this.pickResult.viewObject) {

        const pickedEntityId = this.pickResult.viewObject.id;

        if (this.#lastPickedEntityId !== pickedEntityId) {

          if (this.#lastPickedEntityId !== undefined) {
            events.onHoverOut.dispatch(this.#viewController, {
              viewObject: this.#view.objects[this.#lastPickedEntityId]
            });
          }

          events.onHoverEnter.dispatch(this.#viewController, this.pickResult);
          this.#lastPickedEntityId = pickedEntityId;
        }
      }

      events.onHover.dispatch(this.#viewController, this.pickResult);

    } else {

      /**
       * Transition to "hovering nothing".
       *
       * If we were previously over an entity, emit hoverOut first, then hoverOff.
       */
      if (this.#lastPickedEntityId !== undefined) {
        events.onHoverOut.dispatch(this.#viewController, {
          viewObject: this.#view.objects[this.#lastPickedEntityId]
        });
        this.#lastPickedEntityId = undefined;
      }

      events.onHoverOff.dispatch(this.#viewController, {
        canvasPos: this.pickCursorPos
      });
    }

    /**
     * Clear transient state after publishing.
     *
     * This controller treats pickResult as one evaluation's worth of event payload,
     * not a durable cache across frames.
     */
    this.pickResult = null;

    this.#needFireEvents = 0;
  }
}

export {PickController};
