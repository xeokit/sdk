import {DetailedRender, RealisticRender} from "../../base/constants";
import type {View} from "./View";
import {SDKErrorType, type SDKResult} from "../../base/core";

/**
 * Configures stencil-based section-plane caps for a {@link viewing!viewer.View | View}.
 *
 * * Located at {@link Effects.sectionPlaneCaps}, which lives at {@link View.effects}.
 * * View renders engineering-standard cross-section caps when
 *   {@link View.renderMode} is one of the values in
 *   {@link SectionPlaneCaps.renderModes} **and** at least one
 *   active {@link SectionPlane} carries a {@link SectionPlane.capColor}.
 *
 * The renderer implementation uses a per-plane stencil dance —
 * front-cull pass and back-cull pass write to the stencil
 * counter; a quad on the cut plane is then drawn with the cap
 * colour wherever stencil != 0. The cap surface therefore
 * appears only where the cut plane physically intersects the
 * model, regardless of viewing angle or geometry shape.
 *
 * Set `renderModes` to `[]` (or just don't toggle into a
 * matching mode) to disable the stencil pass entirely — callers
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

  private _renderModes: number[];
  private _destroyed: boolean = false;

  /** @private */
  constructor(view: View, params: { renderModes?: number[] } = {}) {
    this.view = view;
    // Default off — the stencil pass costs ~2 extra model
    // renders per cap-enabled plane per frame, so we make the
    // user opt in explicitly. Callers wanting the prior
    // engineering-cross-section visual flip a render mode in
    // (or pass `renderModes: [DetailedRender, RealisticRender]`
    // at construction).
    this._renderModes = params.renderModes !== undefined ? params.renderModes.slice() : [];
  }

  /**
   * Sets which {@link View.renderMode | render modes} run the
   * stencil cap pass.
   *
   * Default `[]` — caps are off until the caller opts in.
   * `[DetailedRender, RealisticRender]` covers the typical
   * "user is inspecting / presenting" presets.
   */
  set renderModes(value: number[]) {
    this._renderModes = value ? value.slice() : [];
    this.view.needsRender();
  }

  /**
   * Gets the {@link View.renderMode | render modes} that run
   * the stencil cap pass.
   */
  get renderModes(): number[] {
    return this._renderModes;
  }

  /**
   * Gets whether stencil-based caps are currently applied —
   * `true` iff {@link View.renderMode} is in
   * {@link SectionPlaneCaps.renderModes}.
   *
   * The renderer additionally gates per-frame on whether any
   * active {@link SectionPlane} carries a
   * {@link SectionPlane.capColor}; this getter only reports
   * the View-mode side of that gate.
   */
  get applied(): boolean {
    const mode = this.view.renderMode;
    for (let i = 0, len = this._renderModes.length; i < len; i++) {
      if (mode === this._renderModes[i]) return true;
    }
    return false;
  }

  /** Gets this SectionPlaneCaps as JSON. */
  toParams(): SDKResult<{ renderModes: number[] }> {
    return {ok: true, value: {renderModes: this._renderModes.slice()}};
  }

  /** Configures this SectionPlaneCaps. */
  fromParams(params: { renderModes?: number[] }): SDKResult<void> {
    if (this._destroyed) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[SectionPlaneCaps.fromParams] SectionPlaneCaps has been destroyed.",
      });
    }
    if (params.renderModes !== undefined) this.renderModes = params.renderModes;
    return {ok: true, value: undefined};
  }

  /** @private */
  destroy(): void {
    this._destroyed = true;
  }
}
