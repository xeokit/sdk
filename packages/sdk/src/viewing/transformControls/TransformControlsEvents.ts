import {EventDispatcher} from "strongly-typed-events";
import {EventEmitter} from "../../base/core";
import type {TransformControlsDragEvent} from "./TransformControlsDragEvent";

/**
 * Strongly-typed event emitters fired by a {@link TransformControls}.
 */
export class TransformControlsEvents {

  /**
   * Fires on the `pointerdown` that begins a drag, after the gizmo
   * has identified which handle the pointer is over and seeded its
   * drag-start state.
   */
  readonly onDragStart =
      new EventEmitter<unknown, TransformControlsDragEvent>(new EventDispatcher<unknown, TransformControlsDragEvent>());

  /**
   * Fires on the `pointerup` (or `pointercancel`) that ends a drag.
   */
  readonly onDragEnd =
      new EventEmitter<unknown, TransformControlsDragEvent>(new EventDispatcher<unknown, TransformControlsDragEvent>());

  /**
   * Fires whenever the gizmo's own state changes — mode, space,
   * size, snap step, axis visibility, hovered axis, attach / detach.
   * Does **not** fire for target-matrix writes during a drag (use
   * {@link onObjectChange} for those).
   */
  readonly onChange =
      new EventEmitter<unknown, void>(new EventDispatcher<unknown, void>());

  /**
   * Fires every time the target's matrix is written during a drag.
   */
  readonly onObjectChange =
      new EventEmitter<unknown, void>(new EventDispatcher<unknown, void>());

  /**
   * Fires when the attached target's last live
   * {@link model!scene.SceneMesh | SceneMesh} has been destroyed and
   * the gizmo has auto-detached.
   *
   * Hosts can subscribe to this to clear ambient UI state — for
   * example, a toolbar exiting its transform tool-mode when the
   * scene drops the object the user was manipulating. The gizmo's
   * own `detach()` runs first, so by the time this fires the
   * handles are already hidden and `events.onChange` has been
   * dispatched.
   *
   * Targets given as a `{ getMatrix, setMatrix }` adapter never
   * fire this event — the gizmo has no lifecycle hook into the
   * adapter's backing source, and host code remains responsible
   * for calling `detach()` when its source goes away.
   */
  readonly onTargetLost =
      new EventEmitter<unknown, void>(new EventDispatcher<unknown, void>());
}
