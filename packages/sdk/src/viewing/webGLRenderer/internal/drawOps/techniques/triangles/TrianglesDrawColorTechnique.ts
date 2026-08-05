import {DrawTechnique} from "../../DrawTechnique";

/**
 * Draw technique for rendering colored triangles with Lambert shading.
 * @internal
 */
export class TrianglesDrawColorTechnique extends DrawTechnique {

  public readonly vertsPerPrim = 3;

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    this.vsLambertShadingDeclarations();
    if (this._hatchInBody()) this.vsHatchDeclarations();
    this.vsLogDepthDeclarations();
    this.vsMainBegin();
    this.vsLambertShadingLogic();
    if (this._hatchInBody()) this.vsHatchLogic();
    this.vsSlicingLogic();
    this.vsLogDepthLogic();
    this.vsMainEnd();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDeclarations();
    this.fsColorDeclarations();
    this.fsSlicingDeclarations();
    this.fsLambertShadingDeclarations();
    if (this._hatchInBody()) this.fsHatchDeclarations();
    this.fsLogDepthDeclarations();
    this.fsMainBegin();
    // Plain clip-and-discard. Cap rendering (when enabled
    // via `view.effects.sectionPlaneCaps`) is a separate
    // stencil pass managed by RenderManager — the colour FS
    // doesn't know about caps.
    this.fsSlicingLogic();
    this.fsLambertShadingLogic();
    if (this._hatchInBody()) this.fsHatchLogic();
    this.fsOutputColor();
    this.fsLogDepthLogic();
    this.fsMainEnd();
  }

  /**
   * Hatch overlay applies to the model BODY only when the
   * surface path is the un-textured Lambert variant — i.e.
   * neither UVs nor triplanar sampling. PBR variants
   * (`hasUVs`, `triplanar`) stay clean; the material's hatch
   * still shows on the section-plane cap regardless of body
   * shading. Engineering / Detailed presentation owns the
   * hatch-on-body case via the bin-classifier mode gate
   * (DrawOp routes Detailed-mode batches to the un-textured
   * variant so hatch can apply there).
   */
  private _hatchInBody(): boolean {
    return this.bodyHatch && !this.hasUVs && !this.triplanar;
  }
}
