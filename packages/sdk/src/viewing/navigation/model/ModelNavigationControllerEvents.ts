import {EventEmitter} from "../../../base/core";
import {EventDispatcher} from "strongly-typed-events";
import {PickResult} from "../../viewer";
import {HoverEvent, ModelNavigationController} from "./ModelNavigationController";

/**
 * Events fired by ModelNavigationController that users can subscribe to for custom behavior.
 */
export class ModelNavigationControllerEvents {

  /**
   * Event fired when we right-click.
   */
  readonly onRightClick: EventEmitter<ModelNavigationController, any>;

  /**
   * Event fired when the pointer moves while over a {@link viewing!viewer.ViewObject | ViewObject}.
   */
  readonly onHover: EventEmitter<ModelNavigationController, HoverEvent>;

  /**
   * Event fired when the pointer moves while over empty space.
   */
  readonly onHoverOff: EventEmitter<ModelNavigationController, HoverEvent>;

  /**
   * Event fired when the pointer moves onto a {@link viewing!viewer.ViewObject | ViewObject}.
   */
  readonly onHoverEnter: EventEmitter<ModelNavigationController, HoverEvent>;

  /**
   * Event fired when the pointer moves off a {@link viewing!viewer.ViewObject | ViewObject}.
   */
  readonly onHoverOut: EventEmitter<ModelNavigationController, HoverEvent>;

  /**
   * Event fired when a {@link viewing!viewer.ViewObject | ViewObject} is picked.
   */
  readonly onPicked: EventEmitter<ModelNavigationController, PickResult>;

  /**
   * Event fired when empty space is picked.
   */
  readonly onPickedNothing: EventEmitter<ModelNavigationController, null>;

  /**
   * Event fired when a surface is picked (pick result has a world position).
   */
  readonly onPickedSurface: EventEmitter<ModelNavigationController, PickResult>;

  /**
   * Event fired when a ViewObject is double-picked.
   */
  readonly onDoublePicked: EventEmitter<ModelNavigationController, PickResult>;

  /**
   * Event fired when a surface is double-picked.
   */
  readonly onDoublePickedSurface: EventEmitter<ModelNavigationController, PickResult>;

  /**
   * Event fired when empty space is double-picked.
   */
  readonly onDoublePickedNothing: EventEmitter<ModelNavigationController, PickResult>;

  /**
   * Event fired when snapping off a surface, vertex, or edge.
   */
  readonly onHoverSnapOrSurfaceOff: EventEmitter<ModelNavigationController, any>;

  /**
   * Event fired when snapping onto a surface, vertex, or edge.
   */
  readonly onHoverSnapOrSurface: EventEmitter<ModelNavigationController, any>;

  /**
   * Event fired when ray moves.
   */
  readonly onRayMove: EventEmitter<ModelNavigationController, any>;

  /**
   * @private
   */
  constructor() {
    this.onHover = new EventEmitter(new EventDispatcher<ModelNavigationController, HoverEvent>());
    this.onHoverOff = new EventEmitter(new EventDispatcher<ModelNavigationController, HoverEvent>());
    this.onHoverEnter = new EventEmitter(new EventDispatcher<ModelNavigationController, HoverEvent>());
    this.onHoverOut = new EventEmitter(new EventDispatcher<ModelNavigationController, HoverEvent>());
    this.onRightClick = new EventEmitter(new EventDispatcher<ModelNavigationController, any>());
    this.onPicked = new EventEmitter(new EventDispatcher<ModelNavigationController, PickResult>());
    this.onPickedSurface = new EventEmitter(new EventDispatcher<ModelNavigationController, PickResult>());
    this.onPickedNothing = new EventEmitter(new EventDispatcher<ModelNavigationController, any>());
    this.onDoublePicked = new EventEmitter(new EventDispatcher<ModelNavigationController, PickResult>());
    this.onDoublePickedSurface = new EventEmitter(new EventDispatcher<ModelNavigationController, PickResult>());
    this.onDoublePickedNothing = new EventEmitter(new EventDispatcher<ModelNavigationController, PickResult>());
    this.onHoverSnapOrSurfaceOff = new EventEmitter(new EventDispatcher<ModelNavigationController, any>());
    this.onHoverSnapOrSurface = new EventEmitter(new EventDispatcher<ModelNavigationController, any>());
    this.onRayMove = new EventEmitter(new EventDispatcher<ModelNavigationController, any>());
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
