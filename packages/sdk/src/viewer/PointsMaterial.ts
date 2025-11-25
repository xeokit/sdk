import type {PointsMaterialParams} from "./PointsMaterialParams";
import type {View} from "./View";
import {SDKErrorType, SDKResult} from "../core";

/**
 * Configures the size and shape of {@link ViewObject | ViewObjects} that represent clouds of points.
 *
 *
 *
 * * Located at {@link View.pointsMaterial}.
 * * Supports round and square points.
 * * Optional perspective point scaling.
 */
class PointsMaterial {

  /**
   * The View to which this PointsMaterial belongs.
   */
  public readonly view: View;

  private _pointSize: number;
  private _roundPoints: boolean;
  private _perspectivePoints: boolean;
  private _minPerspectivePointSize: number;
  private _maxPerspectivePointSize: number;
  private _filterIntensity: boolean;
  private _minIntensity: number;
  private _maxIntensity: number;
  private _destroyed: boolean = false;

  /**
   * @private
   */
  constructor(view: View, options: {
    pointSize?: number,
    roundPoints?: boolean,
    perspectivePoints?: boolean,
    minPerspectivePointSize?: number,
    maxPerspectivePointSize?: number,
    filterIntensity?: boolean,
    minIntensity?: number,
    maxIntensity?: number
  } = {}) {

    this.view = view;

    this._pointSize = (options.pointSize !== undefined && options.pointSize !== null) ? options.pointSize : 1;
    this._roundPoints = options.roundPoints !== false;
    this._perspectivePoints = options.perspectivePoints !== false;
    this._minPerspectivePointSize = (options.minPerspectivePointSize !== undefined && options.minPerspectivePointSize !== null) ? options.minPerspectivePointSize : 1;
    this._maxPerspectivePointSize = (options.maxPerspectivePointSize !== undefined && options.maxPerspectivePointSize !== null) ? options.maxPerspectivePointSize : 6;
    this._filterIntensity = !!options.filterIntensity;
    this._minIntensity = (options.minIntensity !== undefined && options.minIntensity !== null) ? options.minIntensity : 0;
    this._maxIntensity = (options.maxIntensity !== undefined && options.maxIntensity !== null) ? options.maxIntensity : 1;
  }

  /**
   * Sets point size.
   *
   * Default value is ````2.0```` pixels.
   */
  set pointSize(value: number) {
    this._pointSize = value;
    this.view.needsRender();
  }

  /**
   * Gets point size.
   *
   * Default value is ````2.0```` pixels.
   */
  get pointSize(): number {
    return this._pointSize;
  }

  /**
   * Sets if points are round or square.
   *
   * Default is ````true```` to set points round.
   */
  set roundPoints(value: boolean) {
    if (this._roundPoints === value) {
      return;
    }
    this._roundPoints = value;
    this.view.rebuild();
  }

  /**
   * Gets if points are round or square.
   *
   * Default is ````true```` to set points round.
   */
  get roundPoints(): boolean {
    return this._roundPoints;
  }

  /**
   * Sets if rendered point size reduces with distance when {@link Camera.projection} is set to ````PerspectiveProjectionType````.
   *
   * Default is ````true````.
   */
  set perspectivePoints(value: boolean) {
    if (this._perspectivePoints === value) {
      return;
    }
    this._perspectivePoints = value;
    this.view.rebuild();
  }

  /**
   * Gets if rendered point size reduces with distance when {@link Camera.projection} is set to PerspectiveProjectionType.
   *
   * Default is ````false````.
   */
  get perspectivePoints(): boolean {
    return this._perspectivePoints;
  }

  /**
   * Sets the minimum rendered size of points when {@link PointsMaterial.perspectivePoints} is ````true````.
   *
   * Default value is ````1.0```` pixels.
   */
  set minPerspectivePointSize(value: number) {
    if (this._minPerspectivePointSize === value) {
      return;
    }
    this._minPerspectivePointSize = value;
    this.view.rebuild();
  }

  /**
   * Gets the minimum rendered size of points when {@link PointsMaterial.perspectivePoints} is ````true````.
   *
   * Default value is ````1.0```` pixels.
   *
   * @type {Number}
   */
  get minPerspectivePointSize(): number {
    return this._minPerspectivePointSize;
  }

  /**
   * Sets the maximum rendered size of points when {@link PointsMaterial.perspectivePoints} is ````true````.
   *
   * Default value is ````6```` pixels.
   */
  set maxPerspectivePointSize(value: number) {
    if (this._maxPerspectivePointSize === value) {
      return;
    }
    this._maxPerspectivePointSize = value;
    this.view.rebuild();
  }

  /**
   * Gets the maximum rendered size of points when {@link PointsMaterial.perspectivePoints} is ````true````.
   *
   * Default value is ````6```` pixels.
   */
  get maxPerspectivePointSize(): number {
    return this._maxPerspectivePointSize;
  }

  /**
   * Sets whether points are made invisible when their intensity lies outside {@link PointsMaterial.minIntensity}
   * and {@link PointsMaterial.maxIntensity}.
   *
   * Default is ````false````.
   */
  set filterIntensity(value: boolean) {
    if (this._filterIntensity === value) {
      return;
    }
    this._filterIntensity = value;
    this.view.rebuild();
  }

  /**
   * Gets whether points are made invisible when their intensity lies outside {@link PointsMaterial.minIntensity}
   * and {@link PointsMaterial.maxIntensity}.
   *
   * Default is ````false````.
   */
  get filterIntensity(): boolean {
    return this._filterIntensity;
  }

  /**
   * Sets the minimum intensity of rendered points when {@link PointsMaterial.filterIntensity} is ````true````.
   *
   * Default value is ````0````.
   */
  set minIntensity(value: number) {
    if (this._minIntensity === value) {
      return;
    }
    this._minIntensity = value;
    this.view.needsRender();
  }

  /**
   * Gets the minimum intensity of rendered points when {@link PointsMaterial.filterIntensity} is ````true````.
   *
   * Default value is ````0````.
   */
  get minIntensity(): number {
    return this._minIntensity;
  }

  /**
   * Sets the maximum intensity of rendered points when {@link PointsMaterial.filterIntensity} is ````true````.
   *
   * Default value is ````1````.
   */
  set maxIntensity(value: number) {
    if (this._maxIntensity === value) {
      return;
    }
    this._maxIntensity = value;
    this.view.needsRender();
  }

  /**
   * Gets the maximum intensity of rendered points when {@link PointsMaterial.filterIntensity} is ````true````.
   *
   * Default value is ````1````.
   */
  get maxIntensity(): number {
    return this._maxIntensity;
  }

  /**
   * @private
   */
  get hash(): string {
    return `${this._pointSize};
        ${this._roundPoints};
        ${this._perspectivePoints};
        ${this._minPerspectivePointSize};
        ${this._maxPerspectivePointSize};
        ${this._filterIntensity}`;
  }

  /**
   * Configures this PointsMaterial.
   *
   * @param pointsMaterialParams
   */
  fromParams(pointsMaterialParams: PointsMaterialParams): SDKResult<any, string> {
    if (this._destroyed) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[PointsMaterial.fromParams] PointsMaterial has been destroyed."
      });
    }
    if (pointsMaterialParams.pointSize !== undefined) {
      this.pointSize = pointsMaterialParams.pointSize;
    }
    if (pointsMaterialParams.roundPoints !== undefined) {
      this.roundPoints = pointsMaterialParams.roundPoints;
    }
    if (pointsMaterialParams.perspectivePoints !== undefined) {
      this.perspectivePoints = pointsMaterialParams.perspectivePoints;
    }
    if (pointsMaterialParams.minPerspectivePointSize !== undefined) {
      this.minPerspectivePointSize = pointsMaterialParams.minPerspectivePointSize;
    }
    if (pointsMaterialParams.maxPerspectivePointSize !== undefined) {
      this.maxPerspectivePointSize = pointsMaterialParams.maxPerspectivePointSize;
    }
    if (pointsMaterialParams.filterIntensity !== undefined) {
      this.filterIntensity = pointsMaterialParams.filterIntensity;
    }
    if (pointsMaterialParams.minIntensity !== undefined) {
      this.minIntensity = pointsMaterialParams.minIntensity;
    }
    if (pointsMaterialParams.maxIntensity !== undefined) {
      this.maxIntensity = pointsMaterialParams.maxIntensity;
    }
    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Gets the current configuration of this PointsMaterial.
   */
  toParams(): SDKResult<PointsMaterialParams, never> {
    return {
      ok: true,
      value: {
        pointSize: this.pointSize,
        roundPoints: this.roundPoints,
        perspectivePoints: this.perspectivePoints,
        minPerspectivePointSize: this.minPerspectivePointSize,
        maxPerspectivePointSize: this.maxPerspectivePointSize,
        filterIntensity: this.filterIntensity,
        minIntensity: this.minIntensity,
        maxIntensity: this.maxIntensity
      }
    };
  }

  /**
   * @private
   */
  destroy() {
    this._destroyed = true;
  }
}

export {PointsMaterial};
