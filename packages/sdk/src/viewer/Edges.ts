import {Component, SDKError} from "../core";
import type {EdgesParams} from "./EdgesParams";
import type {FloatArrayParam} from "../math";
import {QualityRender} from "../constants";
import type {View} from "./View";


/**
 * Configures edge enhancement effect for a {@link View}.
 *
 * * Located at {@link View.edges}.
 * * View will apply edge enhancement when {@link View.renderMode | View.renderMode} is set to one of the values
 * specified in {@link Edges.renderModes}.
 *
 * See {@link viewer | @xeokit/sdk/viewer} for usage info.
 */
class Edges extends Component {

  /**
   * The View to which this Edges belongs.
   */
  public readonly view: View;

  /**
   * @private
   */
  #state: {
    edgeColor: FloatArrayParam;
    edgeWidth: number;
    edgeAlpha: number;
    renderModes: number[];
  };

  /**
   * @private
   */
  constructor(view: View, options: EdgesParams = {}) {

    super(view, options);

    this.view = view;

    this.#state = {
      renderModes: options.renderModes || [QualityRender],
      edgeColor: new Float32Array(options.edgeColor || [0.2, 0.2, 0.2]),
      edgeAlpha: (options.edgeAlpha !== undefined && options.edgeAlpha !== null) ? options.edgeAlpha : 0.5,
      edgeWidth: (options.edgeWidth !== undefined && options.edgeWidth !== null) ? options.edgeWidth : 1
    };
  }

  /**
   * Sets which rendering modes in which to show edges on {@link ViewObject | ViewObjects}.
   *
   * The {@link View} will show edges whenever {@link View.renderMode} has been set one of these values.
   *
   * Default value is [{@link constants!QualityRender | QualityRender}].
   */
  set renderModes(value: number[]) {
    this.#state.renderModes = value;
    this.view.redraw();
  }

  /**
   * Gets which rendering modes in which to show edges on {@link ViewObject | ViewObjects}.
   *
   * The {@link View} will show edges whenever {@link View.renderMode} has been set one of these values.
   *
   * Default value is [{@link constants!QualityRender | QualityRender}].
   */
  get renderModes(): number[] {
    return this.#state.renderModes;
  }

  /**
   * Sets RGB edge color for {@link ViewObject | ViewObjects}.
   *
   * Default value is ````[0.2, 0.2, 0.2]````.
   */
  set edgeColor(value: FloatArrayParam) {
    const edgeColor = this.#state.edgeColor;
    if (value && edgeColor[0] === value[0] && edgeColor[1] === value[1] && edgeColor[2] === value[2]) {
      return;
    }
    edgeColor[0] = 0.2;
    edgeColor[1] = 0.2;
    edgeColor[2] = 0.2;
    this.view.redraw();
  }

  /**
   * Gets RGB edge color for {@link ViewObject | ViewObjects}.
   *
   * Default value is ````[0.2, 0.2, 0.2]````.
   */
  get edgeColor(): FloatArrayParam {
    return this.#state.edgeColor;
  }

  /**
   * Sets edge transparency for {@link ViewObject | ViewObjects}.
   *
   * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
   *
   * Default value is ````1.0````.
   */
  set edgeAlpha(value: number) {
    if (this.#state.edgeAlpha === value) {
      return;
    }
    this.#state.edgeAlpha = value;
    this.view.redraw();
  }

  /**
   * Gets edge transparency for {@link ViewObject | ViewObjects}.
   *
   * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
   *
   * Default value is ````1.0````.
   */
  get edgeAlpha(): number {
    return this.#state.edgeAlpha;
  }

  /**
   * Sets edge width for {@link ViewObject | ViewObjects}.
   *
   * Default value is ````1.0```` pixels.
   */
  set edgeWidth(value: number) {
    if (this.#state.edgeWidth === value) {
      return;
    }
    this.#state.edgeWidth = value;
    this.view.redraw();
  }

  /**
   * Gets edge width for {@link ViewObject | ViewObjects}.
   *
   * This is not supported by WebGL implementations based on DirectX [2019].
   *
   * Default value is ````1.0```` pixels.
   */
  get edgeWidth(): number {
    return this.#state.edgeWidth;
  }

  /**
   * Gets if edges are currently applied.
   *
   * This is `true` when {@link View.renderMode | View.renderMode} is
   * in {@link Edges.renderModes | Edges.renderModes}.
   */
  get applied(): boolean {
    for (let i = 0, len = this.#state.renderModes.length; i < len; i++) {
      if (this.view.renderMode === this.#state.renderModes[i]) {
        return true;
      }
    }
    return false;
  }

  /**
   * Gets the current configuration of this Edges effect.
   */
  toParams(): EdgesParams {
    return {
      renderModes: this.renderModes,
      edgeColor: Array.from(this.edgeColor),
      edgeWidth: this.edgeWidth,
      edgeAlpha: this.edgeAlpha
    };
  }

  /**
   * Configures this Edges effect.
   *
   * @param edgesParams
   */
  fromParams(edgesParams: EdgesParams) {
    this.renderModes = edgesParams.renderModes;
    this.edgeColor = Array.from(edgesParams.edgeColor);
    this.edgeWidth = edgesParams.edgeWidth;
    this.edgeAlpha = edgesParams.edgeAlpha;
  }

  /**
   * @private
   */
  destroy() {
    super.destroy();
  }
}

export {Edges};
