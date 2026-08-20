import type {View} from "./View";
import {SDKErrorType, type SDKResult} from "../../base/core";
import type {SectionPlaneCapsParams} from "./SectionPlaneCapsParams";

/**
 * Configures stencil-based section-plane caps for a {@link viewing!viewer.View | View}.
 *
 * * Located at {@link Effects.sectionPlaneCaps}, which lives at {@link View.effects}.
 * * View renders engineering-standard cross-section caps when enabled
 *   and at least one active {@link SectionPlane} carries a
 *   {@link SectionPlane.capColor}.
 *
 * The renderer implementation uses a per-plane stencil technique —
 * front-cull pass and back-cull pass write to the stencil
 * counter; a quad on the cut plane is then drawn with the cap
 * colour wherever stencil != 0. The cap surface therefore
 * appears only where the cut plane physically intersects the
 * model, regardless of viewing angle or geometry shape.
 *
 * Set {@link SectionPlaneCaps.enabled} to `false` to disable the
 * stencil pass entirely — callers
 * who want to provide their own cap geometry (precomputed cap
 * meshes, CSG output from a B-rep kernel, etc.) can just
 * register those as ordinary {@link SceneObject | SceneObjects}
 * with {@link ViewObject.clippable} set to `false` so the
 * section planes don't clip them.
 */
export class SectionPlaneCaps {

  /**
   * The View this SectionPlaneCaps component belongs to.
   */
  public readonly view: View;
  private _enabled: boolean;
  private _destroyed: boolean = false;

  /** @private */
  constructor(view: View, params: SectionPlaneCapsParams = {}) {
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
   * Gets whether stencil-based caps are currently applied.
   *
   * The renderer additionally gates per-frame on whether any
   * active {@link SectionPlane} carries a
   * {@link SectionPlane.capColor}; this getter only reports
   * the View-mode side of that gate.
   */
  get applied(): boolean {
    return this._enabled;
  }

  /** Gets this SectionPlaneCaps as JSON. */
  toParams(): SDKResult<SectionPlaneCapsParams> {
    return {ok: true, value: {enabled: this._enabled}};
  }

  /** Configures this SectionPlaneCaps. */
  fromParams(params: SectionPlaneCapsParams): SDKResult<void> {
    if (this._destroyed) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[SectionPlaneCaps.fromParams] SectionPlaneCaps has been destroyed.",
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
