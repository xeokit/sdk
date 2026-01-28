import type {View} from "./View";

/**
 * Configures the appearance of "lines" geometry primitives.
 *
 * * Located at {@link View#linesMaterial}.
 */
class LinesMaterial  {

  /**
   * The View to which this LinesMaterial belongs.
   */
  public readonly view: View;

 private _lineWidth: number

  /**
   * @private
   */
  constructor(view: View, options: { lineWidth: number } = {lineWidth: 1}) {
    this.view = view;
    this._lineWidth= (options.lineWidth !== undefined && options.lineWidth !== null) ? options.lineWidth : 1;
  }

  /**
   * Sets line width.
   *
   * Default value is ````1```` pixels.
   */
  set lineWidth(value: number) {
    this._lineWidth = value || 1;
    this.view.needsRender();
  }

  /**
   * Gets the line width.
   *
   * Default value is ````1```` pixels.
   */
  get lineWidth(): number {
    return this._lineWidth;
  }
}

export {LinesMaterial};
