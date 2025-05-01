import { Component } from "../core";
import { FastRender } from "../constants";
import { ResolutionScaleParams } from "./ResolutionScaleParams";
import type { View } from "./View";


//  /**
//      * Gets the scale of the canvas back buffer relative to the CSS-defined size of the canvas.
//      *
//      * This is a kdtree3 way to trade off rendering quality for speed. If the canvas size is defined in CSS, then
//      * setting this to a value between ````[0..1]```` (eg ````0.5````) will render into a smaller back buffer, giving
//      * a performance boost.
//      *
//      * @returns  The resolution scale.
//      */
// get resolutionScale(): number {
//     return this.#resolutionScale;
// }
//
// /**
//  * Sets the scale of the canvas back buffer relative to the CSS-defined size of the canvas.
//  *
//  * This is a kdtree3 way to trade off rendering quality for speed. If the canvas size is defined in CSS, then
//  * setting this to a value between ````[0..1]```` (eg ````0.5````) will render into a smaller back buffer, giving
//  * a performance boost.
//  *
//  * @param resolutionScale The resolution scale.
//  */
// set resolutionScale(resolutionScale: number) {
//     resolutionScale = resolutionScale || 1.0;
//     if (resolutionScale === this.#resolutionScale) {
//         return;
//     }
//     this.#resolutionScale = resolutionScale;
//     const htmlElement = this.htmlElement;
//     htmlElement.width = Math.round(
//         htmlElement.clientWidth * this.#resolutionScale
//     );
//     htmlElement.height = Math.round(
//         htmlElement.clientHeight * this.#resolutionScale
//     );
//     this.redraw();
// }

/**
 * Configures canvas resolution scaling for a {@link View}.
 *
 * * Located at {@link View.resolutionScale}.
 * * Resolution scaling reduces the pixel resolution of a View's canvas to improve its frame
 * rate, typically applied temporarily during camera movement to enhance responsiveness.
 * * View will apply resulotion scaling when {@link View.renderMode | View.renderMode} is set to one of the values
 * specified in {@link ResolutionScale.renderModes}.
 *
 * See {@link viewer | @xeokit/sdk/viewer} for usage info.
 */
export class ResolutionScale extends Component {

  /**
     * The View to which this ResolutionScale belongs.
     */
  public readonly view: View;

  /**
     * @private
     */
  #state: {
    resolutionScale: number;
    renderModes: number[];
  };

  /**
     * @private
     */
  constructor(view: View, options: ResolutionScaleParams = {}) {

    super(view, options);

    this.view = view;

    this.#state = {
      renderModes: options.renderModes || [FastRender],
      resolutionScale: options.resolutionScale || 1
    };
  }

  /**
     * Sets which rendering modes in which to apply ResolutionScale.
     *
     * Default value is [{@link constants!FastRender | FastRender}].
     */
  set renderModes(value: number[]) {
    this.#state.renderModes = value;
    this.view.redraw();
  }

  /**
     * Gets which rendering modes in which to apply ResolutionScale.
     *
     * Default value is [{@link constants!FastRender | FastRender}].
     */
  get renderModes(): number[] {
    return this.#state.renderModes;
  }

  /**
     * Sets the scale when ResolutionScale is applied.
     *
     * Default is ````1.0````.
     */
  set resolutionScale(value: number) {
    if (this.#state.resolutionScale === value) {
      return;
    }
    this.#state.resolutionScale = value;
    this.view.redraw();
  }

  /**
     * Gets the scale when ResolutionScale is applied.
     *
     * Default is ````1.0````.
     */
  get resolutionScale(): number {
    return this.#state.resolutionScale;
  }

  /**
     * Gets if resolution scaling is currently applied.
     *
     * This is `true` when {@link View.renderMode | View.renderMode} is
     * in {@link ResolutionScale.renderModes | ResolutionScale.renderModes}.
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
     * Configures this ResolutionScale.
     *
     * @param resolutionScaleParams
     */
  fromParams(resolutionScaleParams: ResolutionScaleParams) {
    if (resolutionScaleParams.renderModes !== undefined) {
      this.renderModes = resolutionScaleParams.renderModes;
    }
    if (resolutionScaleParams.resolutionScale !== undefined) {
      this.resolutionScale = resolutionScaleParams.resolutionScale;
    }
  }

  /**
     * Gets the current configuration of this ResolutionScale.
     */
  toParams(): ResolutionScaleParams {
    return {
      renderModes: this.renderModes,
      resolutionScale: this.resolutionScale
    };
  }

  /**
     * @private
     */
  destroy() {
    super.destroy();
  }
}
