import type {AntiAliasingMode, AntiAliasingParams} from "./AntiAliasingParams";
import type {View} from "./View";
import {SDKErrorType, type SDKResult} from "../../base/core";
import {DetailedRender, RealisticRender} from "../../base/constants";

/**
 * Configures the final antialiasing post-process pass for a {@link viewing!viewer.View | View}.
 *
 * * Located at {@link Effects.antiAliasing}, which lives at {@link View.effects}.
 * * FXAA/SMAA run after {@link Tonemap} so they see final LDR colours.
 * * Has no effect when the renderer has fallen back to LDR mode (no HDR
 *   target), since there's no intermediate texture to filter from.
 */
export class AntiAliasing {

  /** The View this AntiAliasing belongs to. */
  public readonly view: View;

  private _renderModes: number[];
  private _mode: AntiAliasingMode;
  private _destroyed = false;

  /** @private */
  constructor(view: View, params: AntiAliasingParams) {
    this.view = view;
    this._renderModes = params.renderModes !== undefined ? params.renderModes.slice() : [DetailedRender, RealisticRender];
    this._mode = params.mode !== undefined ? params.mode : "smaa";
  }

  /**
   * Sets which rendering modes in which to apply AntiAliasing.
   *
   * The {@link viewing!viewer.View | View} will apply AA whenever {@link View.renderMode} has been set one of these values.
   *
   * Default value is [{@link base!constants.DetailedRender | DetailedRender},
   * {@link base!constants.RealisticRender | RealisticRender}].
   */
  set renderModes(value: number[]) {
    this._renderModes = value;
    this.view.needsRender();
  }

  /**
   * Gets which rendering modes in which to apply AntiAliasing.
   *
   * The {@link viewing!viewer.View | View} will apply AA whenever {@link View.renderMode} has been set one of these values.
   *
   * Default value is [{@link base!constants.DetailedRender | DetailedRender},
   * {@link base!constants.RealisticRender | RealisticRender}].
   */
  get renderModes(): number[] {
    return this._renderModes;
  }

  /**
   * Returns true if AntiAliasing is currently possible given the
   * View's state. The renderer is the authority on whether the GPU
   * can actually run it.
   * @private
   */
  get possible(): boolean {
    return true;
  }

  /**
   * Gets if AntiAliasing is currently applied.
   *
   * This is `true` when {@link View.renderMode | View.renderMode} is
   * in {@link AntiAliasing.renderModes | AntiAliasing.renderModes}.
   */
  get applied(): boolean {
    for (let i = 0, len = this._renderModes.length; i < len; i++) {
      if (this.view.renderMode === this._renderModes[i]) {
        return true;
      }
    }
    return false;
  }

  /** AA mode. Default `"smaa"`. */
  get mode(): AntiAliasingMode {
    return this._mode;
  }

  set mode(value: AntiAliasingMode) {
    if (value !== "none" && value !== "fxaa" && value !== "smaa") return;
    if (this._mode === value) return;
    this._mode = value;
    this.view.needsRender();
  }

  /** Gets this AntiAliasing as JSON. */
  toParams(): SDKResult<AntiAliasingParams> {
    return {
      ok: true,
      value: {
        renderModes: this._renderModes,
        mode: this._mode
      }
    };
  }

  /** Configures this AntiAliasing. */
  fromParams(params: AntiAliasingParams): SDKResult<any> {
    if (this._destroyed) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[AntiAliasing.fromParams] AntiAliasing has been destroyed."
      });
    }
    if (params.renderModes !== undefined) this.renderModes = params.renderModes;
    if (params.mode !== undefined) this.mode = params.mode;
    return {ok: true, value: undefined};
  }

  /** @private */
  destroy() {
    this._destroyed = true;
  }
}
