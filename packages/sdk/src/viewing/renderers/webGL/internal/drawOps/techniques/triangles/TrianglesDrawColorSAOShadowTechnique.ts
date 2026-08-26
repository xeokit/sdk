import {DrawTechnique} from "../../DrawTechnique";

/**
 * Draws colored triangles with Lambert shading and BOTH Scalable Ambient
 * Obscurance and directional shadow mapping applied in the fragment shader.
 *
 * Applied in order Lambert → shadow → SAO. Order matters here because the
 * shadow stage clamps the shadowed result to the material-AO-weighted
 * ambient floor — see fsDrawShadowLogic. SAO is a separate screen-space
 * occlusion term, so it still runs last and modulates whatever lit/shadowed
 * value the shadow stage produced.
 *
 * @internal
 */
export class TrianglesDrawColorSAOShadowTechnique extends DrawTechnique {

  public readonly vertsPerPrim = 3;

  protected buildVertexShader(): void {
    const hatch = this.bodyHatch && !this.hasUVs && !this.triplanar;
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    this.vsLambertShadingDeclarations();
    this.vsDrawShadowDeclarations();
    if (hatch) this.vsHatchDeclarations();
    this.vsLogDepthDeclarations();
    this.vsMainBegin();
    this.vsLambertShadingLogic();
    if (hatch) this.vsHatchLogic();
    this.vsSlicingLogic();
    this.vsDrawShadowLogic();
    this.vsLogDepthLogic();
    this.vsMainEnd();
  }

  protected buildFragmentShader(): void {
    const hatch = this.bodyHatch && !this.hasUVs && !this.triplanar;
    this.fsHeader();
    this.fsPrecisionDeclarations();
    this.fsColorDeclarations();
    this.fsSlicingDeclarations();
    this.fsLambertShadingDeclarations();
    this.fsDrawSAODeclarations();
    this.fsDrawShadowDeclarations();
    if (hatch) this.fsHatchDeclarations();
    this.fsLogDepthDeclarations();
    this.fsMainBegin();
    // Plain clip-and-discard. Caps live in a separate stencil
    // pass managed by RenderManager. Hatch overlay applies to
    // the un-textured Lambert path only.
    this.fsSlicingLogic();
    this.fsLambertShadingLogic();
    this.fsDrawShadowLogic();
    this.fsDrawSAOLogic();
    if (hatch) this.fsHatchLogic();
    this.fsOutputColor();
    this.fsLogDepthLogic();
    this.fsMainEnd();
  }
}
