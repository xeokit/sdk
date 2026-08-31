import type {EffectParams} from "./EffectParams";
import type {View} from "./View";
import {SDKErrorType, type SDKResult} from "../../base/core";
import type {Vec3} from "../../base/math/vector";
import {createVec3Float32} from "../../base/math/vector";

/**
 * Configures the appearance of {@link ViewObject | ViewObjects} that belong to a {@link ViewStyleBin | ViewStyleBin}.
 *
 * * Located at {@link ViewStyleBin.material | ViewStyleBin.material}.
 * * Add a {@link viewing!viewer.ViewObject | ViewObject} to a style bin with {@link ViewObject.setStyleBin | ViewObject.setStyleBin}.
 * * Add multiple {@link viewing!viewer.ViewObject | ViewObjects} to a style bin with {@link View.setObjectsInStyleBin | View.setObjectsInStyleBin}.
 */
class Effect {

  /**
   * The View to which this Effect belongs.
   */
  public readonly view: View;

  private _fillColor: Vec3;
  private _backfaces: boolean;
  private _edgeColor: Vec3;
  private _edgeWidth: number;
  private _edgeAlpha: number;
  private _edges: boolean;
  private _fillAlpha: number;
  private _fill: boolean;
  private _clearDepthBefore: boolean;
  private _destroyed: boolean = false;
  private readonly _onUpdated?: () => void;

  /**
   * @private
   */
  constructor(view: View, options: {
    fillColor?: Vec3;
    backfaces?: boolean;
    edgeColor?: Vec3;
    edgeWidth?: number;
    edgeAlpha?: number;
    edges?: boolean;
    fillAlpha?: number;
    fill?: boolean;
    clearDepthBefore?: boolean;
  } = {}, onUpdated?: () => void) {

    this.view = view;
    this._onUpdated = onUpdated;

    this._fill = options.fill !== false;
    this._fillColor = createVec3Float32(options.fillColor || [0.4, 0.4, 0.4]);
    this._fillAlpha = (options.fillAlpha !== undefined && options.fillAlpha !== null) ? options.fillAlpha : 0.2;
    this._edges = options.edges !== false;
    this._edgeColor = createVec3Float32(options.edgeColor || [0.2, 0.2, 0.2]);
    this._edgeAlpha = (options.edgeAlpha !== undefined && options.edgeAlpha !== null) ? options.edgeAlpha : 0.5;
    this._edgeWidth = (options.edgeWidth !== undefined && options.edgeWidth !== null) ? options.edgeWidth : 1;
    this._backfaces = !!options.backfaces;
    this._clearDepthBefore = options.clearDepthBefore === true;
  }

  private _updated(): void {
    this.view.needsRender();
    this._onUpdated?.();
  }

  /**
   * Sets if style-bin surfaces are filled with color.
   *
   * Default is ````true````.
   */
  set fill(value: boolean) {
    if (this._fill === value) {
      return;
    }
    this._fill = value;
    this._updated();
  }

  /**
   * Gets if style-bin surfaces are filled with color.
   *
   * Default is ````true````.
   */
  get fill(): boolean {
    return this._fill;
  }

  /**
   * Sets the RGB surface fill color for style-bin surfaces.
   *
   * Default is ````[0.4, 0.4, 0.4]````.
   */
  set fillColor(value: Vec3) {
    if (!value || value.length < 3) {
      this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[Effect set fillColor] Invalid color parameter."
      });
      return;
    }
    const fillColor = this._fillColor;
    if (fillColor[0] === value[0] && fillColor[1] === value[1] && fillColor[2] === value[2]) {
      return;
    }
    fillColor[0] = value[0];
    fillColor[1] = value[1];
    fillColor[2] = value[2];
    this._updated();
  }

  /**
   * Gets the RGB surface fill color for style-bin surfaces.
   *
   * Default is ````[0.4, 0.4, 0.4]````.
   */
  get fillColor(): Vec3 {
    return this._fillColor;
  }

  /**
   * Sets the transparency of style-bin surfaces.
   *
   * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
   *
   * Default is ````0.2````.
   */
  set fillAlpha(value: number) {
    if (this._fillAlpha === value) {
      return;
    }
    this._fillAlpha = value;
    this._updated();
  }

  /**
   * Gets the transparency of style-bin surfaces.
   *
   * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
   *
   * Default is ````0.2````.
   */
  get fillAlpha(): number {
    return this._fillAlpha;
  }

  /**
   * Sets if style-bin edges are visible.
   *
   * Default is ````true````.
   */
  set edges(value: boolean) {
    if (this._edges === value) {
      return;
    }
    this._edges = value;
    this._updated();
  }

  /**
   * Gets if style-bin edges are visible.
   *
   * Default is ````true````.
   */
  get edges(): boolean {
    return this._edges;
  }

  /**
   * Sets the RGB color of style-bin edges.
   *
   * Default is ```` [0.2, 0.2, 0.2]````.
   */
  set edgeColor(value: Vec3) {
    if (!value || value.length < 3) {
      this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[Effect set edgeColor] Invalid color parameter."
      });
      return;
    }
    const edgeColor = this._edgeColor;
    if (edgeColor[0] === value[0] && edgeColor[1] === value[1] && edgeColor[2] === value[2]) {
      return;
    }
    edgeColor[0] = value[0];
    edgeColor[1] = value[1];
    edgeColor[2] = value[2];
    this._updated();
  }

  /**
   * Gets the RGB color of style-bin edges.
   *
   * Default is ```` [0.2, 0.2, 0.2]````.
   */
  get edgeColor(): Vec3 {
    return this._edgeColor;
  }

  /**
   * Sets the transparency of style-bin edges.
   *
   * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
   *
   * Default is ````0.2````.
   */
  set edgeAlpha(value: number) {
    if (this._edgeAlpha === value) {
      return;
    }
    this._edgeAlpha = value;
    this._updated();
  }

  /**
   * Gets the transparency of style-bin edges.
   *
   * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
   *
   * Default is ````0.2````.
   */
  get edgeAlpha(): number {
    return this._edgeAlpha;
  }

  /**
   * Sets the width of style-bin edges.
   *
   * Default value is ````1.0```` pixels.
   */
  set edgeWidth(value: number) {
    this._edgeWidth = value;
    this._updated();
  }

  /**
   * Gets the width of style-bin edges.
   *
   * This is not supported by WebGL implementations based on DirectX [2019].
   *
   * Default value is ````1.0```` pixels.
   */
  get edgeWidth(): number {
    return this._edgeWidth;
  }

  /**
   * Sets whether to render backfaces for style-bin surfaces when {@link Effect.fill} is ````true````.
   *
   * Default is ````false````.
   */
  set backfaces(value: boolean) {
    if (this._backfaces === value) {
      return;
    }
    this._backfaces = value;
    this._updated();
  }

  /**
   * Gets whether to render backfaces for style-bin surfaces when {@link Effect.fill} is ````true````.
   *
   * Default is ````false````.
   */
  get backfaces(): boolean {
    return this._backfaces;
  }

  /**
   * Sets whether to clear the depth buffer before rendering this style bin.
   *
   * When ````true````, objects in this style bin are also rendered in a
   * depth-cleared style-bin pass, making the bin treatment visible through
   * occluding geometry while leaving the object's normal rendering treatment
   * intact.
   *
   * Default is ````false````.
   *
   * Note: updating this property marks the View dirty but does not change membership.
   *
   * @type {Boolean}
   */
  set clearDepthBefore(value: boolean) {
    value = (value === true);
    if (this._clearDepthBefore === value) {
      return;
    }
    this._clearDepthBefore = value;
    this._updated();
  }

  /**
   * Gets whether to clear the depth buffer before rendering this style bin.
   *
   * Default is ````false````.
   *
   * @type {Boolean}
   */
  get clearDepthBefore(): boolean {
    return this._clearDepthBefore;
  }

  /**
   * @private
   */
  get hash(): string {
    return "";
  }

  /**
   * Configures this Effect.
   * @param effectParams
   */
  fromParams(effectParams: EffectParams): SDKResult<any> {
    if (this._destroyed) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[Effect.fromParams] Effect has been destroyed."
      });
    }
    if (effectParams.fillColor !== undefined) {
      this.fillColor = effectParams.fillColor;
    }
    if (effectParams.edgeColor !== undefined) {
      this.edgeColor = effectParams.edgeColor;
    }
    if (effectParams.edgeWidth !== undefined) {
      this.edgeWidth = effectParams.edgeWidth;
    }
    if (effectParams.edgeAlpha !== undefined) {
      this.edgeAlpha = effectParams.edgeAlpha;
    }
    if (effectParams.edges !== undefined) {
      this.edges = effectParams.edges;
    }
    if (effectParams.fillAlpha !== undefined) {
      this.fillAlpha = effectParams.fillAlpha;
    }
    if (effectParams.fill !== undefined) {
      this.fill = effectParams.fill;
    }
    if (effectParams.backfaces !== undefined) {
      this.backfaces = effectParams.backfaces;
    }
    if (effectParams.clearDepthBefore !== undefined) {
      this.clearDepthBefore = effectParams.clearDepthBefore;
    }
    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Gets the current configuration of this Effect.
   */
  toParams(): SDKResult<EffectParams> {
    return {
      ok: true,
      value: {
        fillColor: <Vec3>Array.from(this._fillColor),
        backfaces: this._backfaces,
        edgeColor: <Vec3>Array.from(this._edgeColor),
        edgeWidth: this._edgeWidth,
        edgeAlpha: this._edgeAlpha,
        edges: this._edges,
        fillAlpha: this._fillAlpha,
        fill: this._fill,
        clearDepthBefore: this._clearDepthBefore
      }
    };
  }

  /**
   * @private
   */
  destroy(): void {
    this._destroyed = true;
  }
}

export {Effect};
