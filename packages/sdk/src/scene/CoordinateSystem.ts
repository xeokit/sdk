import {Component, EventEmitter} from "../core";
import {type FloatArrayParam} from "../math";
import {type CoordinateSystemParams} from "./CoordinateSystemParams";
import {EventDispatcher} from "strongly-typed-events";
import {Scene} from "./Scene";
import {SceneModel} from "./SceneModel";
import {createVec3} from "../matrix";

/**
 * Represents a 3D coordinate system.
 *
 * A `CoordinateSystem` defines a spatial reference frame using a 3x3 basis matrix and an origin point in global space.
 * It also supports various unit systems and an optional scale-to-meters factor for unit normalization.
 *
 * This class emits change events for updates to its `basis`, `origin`, `units`, and `scaleToMeters` properties, as well
 * as a general `onUpdated` event whenever any of these properties change. The directional vectors `worldUp`, `worldRight`,
 * and `worldForward` are derived from the basis and represent the orientation of the coordinate system in world space.
 *
 * Used by {@link Scene} and {@link SceneModel} components to define and manage spatial context for scene content.
 */
export class CoordinateSystem extends Component {

  #notifyUpdatedScheduled: boolean;

  private _basis: FloatArrayParam;
  private _origin: FloatArrayParam;
  private _units: 'meters' | 'millimeters' | 'inches' | 'feet';
  private _scaleToMeters?: number;
  private _worldUp: FloatArrayParam;
  private _worldRight: FloatArrayParam;
  private _worldForward: FloatArrayParam;

  /**
   * Emits an event each time {@link CoordinateSystem.basis | CoordinateSystem.basis } updates.
   * @event
   */
  readonly onBasis: EventEmitter<CoordinateSystem, FloatArrayParam>;

  /**
   * Emits an event each time {@link CoordinateSystem.origin | CoordinateSystem.origin} updates.
   * @event
   */
  readonly onOrigin: EventEmitter<CoordinateSystem, FloatArrayParam>;

  /**
   * Emits an event each time {@link CoordinateSystem.units | CoordinateSystem.units} updates.
   * @event
   */
  readonly onUnits: EventEmitter<CoordinateSystem, string>;

  /**
   * Emits an event each time {@link CoordinateSystem.scaleToMeters | CoordinateSystem.scaleToMeters} updates.
   * @event
   */
  readonly onScaleToMeters: EventEmitter<CoordinateSystem, number>;

  /**
   * Emits an event each time any property updates.
   * @event
   */
  readonly onUpdated: EventEmitter<CoordinateSystem, CoordinateSystem>;

  /**
   * @private
   */
  constructor(parent: Scene | SceneModel, params: CoordinateSystemParams) {
    super(parent);

    this.onBasis = new EventEmitter(new EventDispatcher<CoordinateSystem, FloatArrayParam>());
    this.onOrigin = new EventEmitter(new EventDispatcher<CoordinateSystem, FloatArrayParam>());
    this.onUnits = new EventEmitter(new EventDispatcher<CoordinateSystem, string>());
    this.onScaleToMeters = new EventEmitter(new EventDispatcher<CoordinateSystem, number>());
    this.onUpdated = new EventEmitter(new EventDispatcher<CoordinateSystem, CoordinateSystem>());

    this._basis = new Float32Array(params.basis || [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    this._origin = new Float64Array(params.origin || [0, 0, 0]);
    this._units = params.units || "meters";
    this._scaleToMeters = params.scaleToMeters || 1;
    this._worldUp = createVec3();
    this._worldRight = createVec3();
    this._worldForward = createVec3();
  }

  #notifyUpdated() {
    if (!this.#notifyUpdatedScheduled) {
      this.#notifyUpdatedScheduled = true;
      setTimeout(() => {
        this.#notifyUpdatedScheduled = false;
        this.onUpdated.dispatch(this, this);
      }, 100)
    }
  }

  /** Gets the flat 9-element coordinate system basis (column-major). */
  get basis(): FloatArrayParam {
    return this._basis;
  }

  /** Sets the flat 9-element coordinate system basis (column-major). */
  set basis(value: FloatArrayParam) {
    this._basis = new Float32Array(value);
    this._worldRight[0] = this._basis[0];
    this._worldRight[1] = this._basis[1];
    this._worldRight[2] = this._basis[2];
    this._worldUp[0] = this._basis[3];
    this._worldUp[1] = this._basis[4];
    this._worldUp[2] = this._basis[5];
    this._worldForward[0] = this._basis[6];
    this._worldForward[1] = this._basis[7];
    this._worldForward[2] = this._basis[8];
    this.onBasis.dispatch(this, this._basis);
    this.#notifyUpdated();
  }

  /** Gets the origin of the coordinate system in global space. */
  get origin(): FloatArrayParam {
    return this._origin;
  }

  /** Sets the origin of the coordinate system in global space. */
  set origin(value: FloatArrayParam) {
    this._origin = new Float32Array(value);
    this.onOrigin.dispatch(this, this._origin);
    this.#notifyUpdated();
  }

  /** Gets the unit system used. */
  get units(): 'meters' | 'millimeters' | 'inches' | 'feet' {
    return this._units;
  }

  /** Sets the unit system used. */
  set units(value: 'meters' | 'millimeters' | 'inches' | 'feet') {
    this._units = value;
    this.onUnits.dispatch(this, this._units);
    this.#notifyUpdated();
  }

  /** Gets the optional scale-to-meters multiplier. */
  get scaleToMeters(): number | undefined {
    return this._scaleToMeters;
  }

  /** Sets the optional scale-to-meters multiplier. */
  set scaleToMeters(value: number | undefined) {
    this._scaleToMeters = value;
    this.onScaleToMeters.dispatch(this, this._scaleToMeters);
    this.#notifyUpdated();
  }

  /**
   * Gets the direction of World-space "up".
   *
   * This is set by {@link CoordinateSystem.basis}.
   *
   * Default value is ````[0,0,1]````.
   *
   * @returns {Number[]} The "up" vector.
   */
  get worldUp(): FloatArrayParam {
    return this._worldUp;
  }

  /**
   * Gets the direction of World-space "right".
   *
   * This is set by {@link CoordinateSystem.basis}.
   *
   * Default value is ````[1,0,0]````.
   *
   * @returns {Number[]} The "right" vector.
   */
  get worldRight(): FloatArrayParam {
    return this._worldRight;
  }

  /**
   * Gets the direction of World-space "forwards".
   *
   * This is set by {@link CoordinateSystem.basis}.
   *
   * Default value is ````[0,0,-1]````.
   *
   * @returns {Number[]} The "forwards" vector.
   */
  get worldForward(): FloatArrayParam {
    return this._worldForward;
  }

  /**
   * Gets if the World-space X-axis is "up".
   * @returns {boolean}
   */
  get xUp(): boolean {
    return this._worldUp[0] > this._worldUp[1] && this._worldUp[0] > this._worldUp[2];
  }

  /**
   * Gets if the World-space Y-axis is "up".
   * @returns {boolean}
   */
  get yUp(): boolean {
    return this._worldUp[1] > this._worldUp[0] && this._worldUp[1] > this._worldUp[2];
  }

  /**
   * Gets if the World-space Z-axis is "up".
   * @returns {boolean}
   */
  get zUp(): boolean {
    return this._worldUp[2] > this._worldUp[0] && this._worldUp[2] > this._worldUp[1];
  }

  /**
   * Returns a copy of the current state as a CoordinateSystemParams object.
   */
  toParams(): CoordinateSystemParams {
    return {
      basis: Array.from(this._basis),
      origin: Array.from(this._origin),
      units: this._units,
      scaleToMeters: this._scaleToMeters
    };
  }

  /**
   * Updates this instance's state from a CoordinateSystemParams object.
   */
  fromParams(params: CoordinateSystemParams): void {
    this._basis = new Float32Array(params.basis);
    this._origin = new Float64Array(params.origin);
    this._units = params.units;
    this._scaleToMeters = params.scaleToMeters;
    this.#notifyUpdated();
  }
}
