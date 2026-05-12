import {EventEmitter} from "../core";
import {EventDispatcher} from "strongly-typed-events";
import {PickResult} from "../viewer";
import {HoverEvent, ViewController} from "./ViewController";

/**
 * Events fired by {@link viewController!ViewController} that users can subscribe to for custom behavior.
 */
export class ViewControllerEvents {

  /**
   * Event fired when we right-click.
   */
  readonly onRightClick: EventEmitter<ViewController, any>;

  /**
   * Event fired when the pointer moves while over a {@link viewer!ViewObject | ViewObject}.
   */
  readonly onHover: EventEmitter<ViewController, HoverEvent>;

  /**
   * Event fired when the pointer moves while over empty space.
   */
  readonly onHoverOff: EventEmitter<ViewController, HoverEvent>;

  /**
   * Event fired when the pointer moves onto a {@link viewer!ViewObject | ViewObject}.
   */
  readonly onHoverEnter: EventEmitter<ViewController, HoverEvent>;

  /**
   * Event fired when the pointer moves off a {@link viewer!ViewObject | ViewObject}.
   */
  readonly onHoverOut: EventEmitter<ViewController, HoverEvent>;

  /**
   * Event fired when a {@link viewer!ViewObject | ViewObject} is picked.
   */
  readonly onPicked: EventEmitter<ViewController, PickResult>;

  /**
   * Event fired when empty space is picked.
   */
  readonly onPickedNothing: EventEmitter<ViewController, null>;

  /**
   * Event fired when a surface is picked (pick result has a world position).
   */
  readonly onPickedSurface: EventEmitter<ViewController, PickResult>;

  /**
   * Event fired when a ViewObject is double-picked.
   */
  readonly onDoublePicked: EventEmitter<ViewController, PickResult>;

  /**
   * Event fired when a surface is double-picked.
   */
  readonly onDoublePickedSurface: EventEmitter<ViewController, PickResult>;

  /**
   * Event fired when empty space is double-picked.
   */
  readonly onDoublePickedNothing: EventEmitter<ViewController, PickResult>;

  /**
   * Event fired when snapping off a surface, vertex, or edge.
   */
  readonly onHoverSnapOrSurfaceOff: EventEmitter<ViewController, any>;

  /**
   * Event fired when snapping onto a surface, vertex, or edge.
   */
  readonly onHoverSnapOrSurface: EventEmitter<ViewController, any>;

  /**
   * Event fired when ray moves.
   */
  readonly onRayMove: EventEmitter<ViewController, any>;

  /**
   * @private
   */
  constructor() {
    this.onHover = new EventEmitter(new EventDispatcher<ViewController, HoverEvent>());
    this.onHoverOff = new EventEmitter(new EventDispatcher<ViewController, HoverEvent>());
    this.onHoverEnter = new EventEmitter(new EventDispatcher<ViewController, HoverEvent>());
    this.onHoverOut = new EventEmitter(new EventDispatcher<ViewController, HoverEvent>());
    this.onRightClick = new EventEmitter(new EventDispatcher<ViewController, any>());
    this.onPicked = new EventEmitter(new EventDispatcher<ViewController, PickResult>());
    this.onPickedSurface = new EventEmitter(new EventDispatcher<ViewController, PickResult>());
    this.onPickedNothing = new EventEmitter(new EventDispatcher<ViewController, any>());
    this.onDoublePicked = new EventEmitter(new EventDispatcher<ViewController, PickResult>());
    this.onDoublePickedSurface = new EventEmitter(new EventDispatcher<ViewController, PickResult>());
    this.onDoublePickedNothing = new EventEmitter(new EventDispatcher<ViewController, PickResult>());
    this.onHoverSnapOrSurfaceOff = new EventEmitter(new EventDispatcher<ViewController, any>());
    this.onHoverSnapOrSurface = new EventEmitter(new EventDispatcher<ViewController, any>());
    this.onRayMove = new EventEmitter(new EventDispatcher<ViewController, any>());
  }

  /**
   * @private
   */
  clear() {
    this.onHover.clear();
    this.onHoverOff.clear();
    this.onHoverEnter.clear();
    this.onHoverOut.clear();
    this.onRightClick.clear();
    this.onPicked.clear();
    this.onPickedSurface.clear();
    this.onPickedNothing.clear();
    this.onDoublePicked.clear();
    this.onDoublePickedSurface.clear();
    this.onDoublePickedNothing.clear();
    this.onHoverSnapOrSurfaceOff.clear();
    this.onHoverSnapOrSurface.clear();
    this.onRayMove.clear();
  }
}
