import { Component } from "../core";
import type { View } from "./View";
import { QualityRender } from "../constants";


/**
 * Configures whether a {@link View} shows textures on its {@link ViewObject | ViewObjects}.
 *
 * * Located at {@link View.texturing}.
 *
 * See {@link viewer | @xeokit/sdk/viewer} for usage info.
 */
class Texturing extends Component {

  /**
     * The View to which this Texturing belongs.
     */
  public readonly view: View;

  /**
     * @private
     */
  #state: {
    enabled: boolean;
    renderModes: number[];
  };

  /**
     * @private
     */
  constructor(view: View, options: {
    enabled?: boolean;
    renderModes?: number[];
  } = {}) {

    super(view, options);

    this.view = view;

    this.#state = {
      renderModes: options.renderModes || [QualityRender],
      enabled: options.enabled !== false
    };
  }

  /**
     * Sets which rendering modes in which to render textures.
     *
     * Accepted modes are {@link constants!QualityRender} and {@link constants!FastRender}.
     *
     * Default value is [{@link constants!QualityRender}].
     */
  set renderModes(value: number[]) {
    this.#state.renderModes = value;
    this.view.redraw();
  }

  /**
     * Gets which rendering modes in which to render textures.
     *
     * Accepted modes are {@link constants!QualityRender} and {@link constants!FastRender}.
     *
     * Default value is [{@link constants!QualityRender}].
     */
  get renderModes(): number[] {
    return this.#state.renderModes;
  }

  /**
     * Sets if textures on {@link ViewObject | ViewObjects} are visible.
     *
     * Default is ````true````.
     */
  set enabled(value: boolean) {
    if (this.#state.enabled === value) {
      return;
    }
    this.#state.enabled = value;
    this.view.redraw();
  }

  /**
     * Gets if textures on {@link ViewObject | ViewObjects} are visible.
     *
     * Default is ````true````.
     */
  get enabled(): boolean {
    return this.#state.enabled;
  }

  /**
     * Gets if textures are currently applied.
     *
     * This is `true` when {@link Texturing.enabled | Texturing.enabled} is `true`
     * and {@link View.renderMode | View.renderMode} is
     * in {@link Texturing.renderModes | Texturing.renderModes}.
     */
  get applied(): boolean {
    if (!this.#state.enabled) {
      return false;
    }
    for (let i = 0, len = this.#state.renderModes.length; i < len; i++) {
      if (this.view.renderMode === this.#state.renderModes[i]) {
        return true;
      }
    }
    return false;
  }

  /**
     * @private
     */
  destroy() {
    super.destroy();
  }
}

export { Texturing };
