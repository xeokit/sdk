import {DetailedRender} from "../../base/constants";
import type {View} from "./View";

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
 * material are ignored — they re-enter the picture in
 * RealisticRender (or any mode without bodyHatch).
 *
 * Default: `[`{@link base!constants.DetailedRender | DetailedRender}`]` —
 * engineering / inspection presentation gets the hatched body
 * out of the box; Realistic and Navigation stay PBR/textured.
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

  private _renderModes: number[];
  private _destroyed: boolean = false;

  /** @private */
  constructor(view: View, params: { renderModes?: number[] } = {}) {
    this.view = view;
    this._renderModes = params.renderModes !== undefined
      ? params.renderModes.slice()
      : [DetailedRender];
  }

  /**
   * Sets which {@link View.renderMode | render modes} render with
   * the hatched-Lambert body path. Other modes use the standard
   * attribute-driven selection (PBR when the mesh has UVs /
   * triplanar atlases, plain Lambert otherwise).
   *
   * Default `[DetailedRender]`.
   */
  set renderModes(value: number[]) {
    this._renderModes = value ? value.slice() : [];
    this.view.needsRender();
  }

  /**
   * Gets which {@link View.renderMode | render modes} use the
   * hatched-Lambert body path.
   */
  get renderModes(): number[] {
    return this._renderModes;
  }

  /**
   * Whether hatched-Lambert body shading is currently applied —
   * `true` iff {@link View.renderMode} is in
   * {@link BodyHatch.renderModes}. The renderer reads this
   * flag in its DrawOp variant selector to decide between the
   * un-textured Lambert variant and the PBR-textured variant
   * for opaque triangle batches.
   */
  get applied(): boolean {
    const mode = this.view.renderMode;
    for (let i = 0, len = this._renderModes.length; i < len; i++) {
      if (mode === this._renderModes[i]) return true;
    }
    return false;
  }

  /** @private */
  destroy(): void {
    this._destroyed = true;
  }
}
