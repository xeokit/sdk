import * as matrix from '../matrix';
import {Component, EventEmitter} from "../core";
import {EventDispatcher} from "strongly-typed-events";
import type {FloatArrayParam} from "../math";
import {type SectionPlaneParams} from "./SectionPlaneParams";
import type {View} from "./View";


/**
 *  An arbitrarily-aligned World-space clipping plane.
 *
 * * Belongs to a {@link View | View}.
 * * Registered by {@link SectionPlane.id} in {@link View.sectionPlanes}.
 * * Slices portions off {@link ViewObject | ViewObjects} to create cross-section views or reveal interiors.
 * * Indicates its World-space position in {@link SectionPlane.pos} and orientation vector in {@link SectionPlane.dir}.
 * * Discards elements from the half-space in the direction of {@link SectionPlane.dir}.
 * * Can be be enabled or disabled via {@link SectionPlane.active}.
 *
 * See {@link viewer | @xeokit/sdk/viewer} for usage info.
 */
class SectionPlane extends Component {

  /**
   ID of this SectionPlane, unique within the {@link View}.
   */
  declare public id: string;

  /**
   * The View to which this SectionPlane belongs.
   *
   * @property view
   * @type {View}
   *
   */
  public readonly view: View;

  /**
   * Emits an event each time {@link SectionPlane.pos} changes.
   *
   * @event
   */
  readonly onPos: EventEmitter<SectionPlane, FloatArrayParam>;

  /**
   * Emits an event each time {@link SectionPlane.dir} changes.
   *
   * @event
   */
  readonly onDir: EventEmitter<SectionPlane, FloatArrayParam>;

  /**
   * Emits an event each time {@link SectionPlane.active} changes.
   *
   * @event
   */
  readonly onActive: EventEmitter<SectionPlane, boolean>;

  #state: {
    pos: Float64Array;
    active: boolean;
    dist: number;
    dir: Float32Array
  };

  /**
   * @private
   *
   */
  constructor(view: View, sectionPlaneParams: SectionPlaneParams = {}) {

    super(view, sectionPlaneParams);

    this.view = view;

    this.#state = {
      active: sectionPlaneParams.active !== false,
      pos: new Float64Array(sectionPlaneParams.pos || [0, 0, 0]),
      dir: new Float32Array(sectionPlaneParams.pos || [0, 0, -1]),
      dist: 0
    };

    this.onPos = new EventEmitter(new EventDispatcher<SectionPlane, FloatArrayParam>());
    this.onDir = new EventEmitter(new EventDispatcher<SectionPlane, FloatArrayParam>());
    this.onActive = new EventEmitter(new EventDispatcher<SectionPlane, boolean>());
  }

  /**
   * Gets if this SectionPlane is active or not.
   *
   * Default value is ````true````.
   *
   * @returns Returns ````true```` if active.
   */
  get active(): boolean {
    return this.#state.active;
  }

  /**
   * Sets if this SectionPlane is active or not.
   *
   * Default value is ````true````.
   *
   * @param value Set ````true```` to activate else ````false```` to deactivate.
   */
  set active(value: boolean) {
    if (this.#state.active === value) {
      return;
    }
    this.#state.active = value;
    this.view.redraw();
    this.onActive.dispatch(this, this.#state.active);
  }

  /**
   * Gets the World-space position of this SectionPlane's plane.
   *
   * Default value is ````[0, 0, 0]````.
   *
   * @returns  Current position.
   */
  get pos(): FloatArrayParam {
    return this.#state.pos;
  }

  /**
   * Sets the World-space position of this SectionPlane's plane.
   *
   * Default value is ````[0, 0, 0]````.
   *
   * @param value New position.
   */
  set pos(value: FloatArrayParam) {
    this.#state.pos.set(value);
    this.#state.dist = (-matrix.dotVec3(this.#state.pos, this.#state.dir));
    this.onPos.dispatch(this, this.#state.pos);
  }

  /**
   * Gets the direction of this SectionPlane's plane.
   *
   * Default value is ````[0, 0, -1]````.
   *
   * @returns value Current direction.
   */
  get dir(): FloatArrayParam {
    return this.#state.dir;
  }

  /**
   * Sets the direction of this SectionPlane's plane.
   *
   * Default value is ````[0, 0, -1]````.
   *
   * @param value New direction.
   */
  set dir(value: FloatArrayParam) {
    this.#state.dir.set(value);
    this.#state.dist = (-matrix.dotVec3(this.#state.pos, this.#state.dir));
    this.view.redraw();
    this.onDir.dispatch(this, this.#state.dir);
  }

  /**
   * Gets this SectionPlane's distance to the origin of the World-space coordinate system.
   *
   * This is the dot product of {@link SectionPlane.pos} and {@link SectionPlane.dir} and is automatically re-calculated
   * each time either of two properties are updated.
   *
   * @returns Distance to the origin of the World-space coordinate system.
   */
  get dist(): number {
    return this.#state.dist;
  }

  /**
   * Inverts the direction of {@link SectionPlane.dir}.
   */
  flipDir() {
    const dir = this.#state.dir;
    dir[0] *= -1.0;
    dir[1] *= -1.0;
    dir[2] *= -1.0;
    this.#state.dist = (-matrix.dotVec3(this.#state.pos, this.#state.dir));
    this.onDir.dispatch(this, this.#state.dir);
    this.view.redraw();
  }

  /**
   * COnfigures this SectionPlane.
   *
   * @param sectionPlaneParams
   */
  fromParams(sectionPlaneParams: SectionPlaneParams) {
    if (sectionPlaneParams.dir) {
      this.dir = sectionPlaneParams.dir;
    }
    if (sectionPlaneParams.pos) {
      this.pos = sectionPlaneParams.pos;
    }
    if (sectionPlaneParams.active !== undefined) {
      this.active = sectionPlaneParams.active;
    }
  }

  /**
   * Gets the current configuration of this SectionPlane.
   */
  toParams(): SectionPlaneParams {
    return {
      id: this.id,
      dir: Array.from(this.#state.dir),
      pos: Array.from(this.#state.pos),
      active: this.#state.active
    };
  }

  /**
   * Destroys this SectionPlane.
   */
  destroy() {
    this.onPos.clear();
    this.onActive.clear;
    this.onDir.clear();
    super.destroy();
  }
}

export {SectionPlane};
