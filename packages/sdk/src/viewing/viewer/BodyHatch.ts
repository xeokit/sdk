import type {View} from "./View";
import {SDKErrorType, type SDKResult} from "../../base/core";
import type {BodyHatchParams} from "./BodyHatchParams";

/**
 * Configures whether the View renders surfaces with the
 * material's hatch overlay (engineering / schematic style)
 * rather than the PBR-textured path.
 *
 * Located at {@link Effects.bodyHatch}.
 *
 * When `applied`, the renderer routes opaque triangle batches to
 * the un-textured Lambert variant of the colour technique. The
 * material's `hatchPattern` (when set) overlays the body in
 * world / tangent / screen space according to its `space`. PBR
 * atlases (albedo / metallic-roughness / normal) on the same
 * material are ignored while the component is applied.
 *
 * Section-plane caps are unaffected. The cap's appearance comes
 * from {@link SectionPlane.capColor} and the material's hatch
 * regardless of body shading — it's an engineering symbol, not
 * a surface continuation. So a single material renders as
 * polished steel in Realistic, hatched steel in Detailed, and
 * shows the ANSI32 steel cap fill in either mode.
 */
export class BodyHatch {

  public readonly view: View;
  private _enabled: boolean;
  private _destroyed: boolean = false;

  /** @private */
  constructor(view: View, params: BodyHatchParams = {}) {
    this.view = view;
    this._enabled = params.enabled === true;
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
   * Whether hatched-Lambert body shading is currently applied.
   */
  get applied(): boolean {
    return this._enabled;
  }

  /** Gets this BodyHatch as JSON. */
  toParams(): SDKResult<BodyHatchParams> {
    return {ok: true, value: {enabled: this._enabled}};
  }

  /** Configures this BodyHatch. */
  fromParams(params: BodyHatchParams): SDKResult<void> {
    if (this._destroyed) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[BodyHatch.fromParams] BodyHatch has been destroyed.",
      });
    }
    if (params.enabled !== undefined) {
      this.enabled = params.enabled;
    }
    return {ok: true, value: undefined};
  }

  /** @private */
  destroy(): void {
    this._destroyed = true;
  }
}
