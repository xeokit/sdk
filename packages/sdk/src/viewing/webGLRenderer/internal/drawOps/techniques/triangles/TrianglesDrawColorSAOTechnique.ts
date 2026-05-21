import {DrawTechnique} from "../../DrawTechnique";

/**
 * Draw technique for rendering colored triangles with Lambert shading and SAO occlusion.
 * @internal
 */
export class TrianglesDrawColorSAOTechnique extends DrawTechnique {

  public readonly vertsPerPrim = 3;

  protected buildVertexShader(): void {
    const hatch = !this.hasUVs && !this.triplanar;
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    this.vsLambertShadingDeclarations();
    if (hatch) this.vsHatchDeclarations();
    this.vsLogDepthDeclarations();
    this.vsMainBegin();
    this.vsLambertShadingLogic();
    if (hatch) this.vsHatchLogic();
    this.vsSlicingLogic();
    this.vsLogDepthLogic();
    this.vsMainEnd();
  }

  protected buildFragmentShader(): void {
    const hatch = !this.hasUVs && !this.triplanar;
    this.fsHeader();
    this.fsPrecisionDeclarations();
    this.fsColorDeclarations();
    this.fsSlicingDeclarations();
    this.fsLambertShadingDeclarations();
    this.fsDrawSAODeclarations();
    if (hatch) this.fsHatchDeclarations();
    this.fsLogDepthDeclarations();
    this.fsMainBegin();
    // Plain clip-and-discard before lighting. Caps live in
    // a separate stencil pass managed by RenderManager. Hatch
    // overlay applies only to the un-textured Lambert variant
    // — PBR (hasUVs / triplanar) stays clean.
    this.fsSlicingLogic();
    this.fsLambertShadingLogic();
    this.fsDrawSAOLogic();
    if (hatch) this.fsHatchLogic();
    this.fsOutputColor();
    this.fsLogDepthLogic();
    this.fsMainEnd();
  }
}
