import type {AntiAliasingMode, AntiAliasingParams} from "./AntiAliasingParams";
import type {View} from "./View";
import {SDKErrorType, type SDKResult} from "../../base/core";

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
  private _enabled: boolean;
  private _mode: AntiAliasingMode;
  private _destroyed = false;

  /** @private */
  constructor(view: View, params: AntiAliasingParams) {
    this.view = view;
    this._enabled = params.enabled !== false;
    this._mode = params.mode !== undefined ? params.mode : "smaa";
  }

      set enabled(value: boolean) {
    const enabled = value === true;
    if (this._enabled === enabled) return;
    this._enabled = enabled;
    this.view.needsRender();
  }

  get enabled(): boolean {
    return this._enabled;
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
   * This is `true` when the component enabled state is
   * in the component enabled state.
   */
  get applied(): boolean {
    return this._enabled;
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
        enabled: this._enabled,
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
    if (params.mode !== undefined) this.mode = params.mode;
    return {ok: true, value: undefined};
  }

  /** @private */
  destroy() {
    this._destroyed = true;
  }
}
