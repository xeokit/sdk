import {DrawTechnique} from "../../DrawTechnique";

/**
 * Draws colored triangles with Lambert shading, sampling the shadow-map depth
 * texture to darken fragments that are occluded from the shadow-casting light.
 *
 * @internal
 */
export class TrianglesDrawColorShadowTechnique extends DrawTechnique {

  public readonly vertsPerPrim = 3;

  protected buildVertexShader(): void {
    const hatch = !this.hasUVs && !this.triplanar;
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
    const hatch = !this.hasUVs && !this.triplanar;
    this.fsHeader();
    this.fsPrecisionDeclarations();
    this.fsColorDeclarations();
    this.fsSlicingDeclarations();
    this.fsLambertShadingDeclarations();
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
    if (hatch) this.fsHatchLogic();
    this.fsOutputColor();
    this.fsLogDepthLogic();
    this.fsMainEnd();
  }
}
