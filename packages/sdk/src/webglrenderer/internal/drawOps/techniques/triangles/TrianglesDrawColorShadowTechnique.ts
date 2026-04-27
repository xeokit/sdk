import {DrawTechnique} from "../../DrawTechnique";

/**
 * Draws colored triangles with Lambert shading, sampling the shadow-map depth
 * texture to darken fragments that are occluded from the shadow-casting light.
 *
 * @internal
 */
export class TrianglesDrawColorShadowTechnique extends DrawTechnique {

  protected readonly vertsPerPrim = 3;

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    this.vsLambertShadingDeclarations();
    this.vsDrawShadowDeclarations();
    this.vsMainBegin();
    this.vsLambertShadingLogic();
    this.vsSlicingLogic();
    this.vsDrawShadowLogic();
    this.vsMainEnd();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDeclarations();
    this.fsColorDeclarations();
    this.fsSlicingDeclarations();
    this.fsLambertShadingDeclarations();
    this.fsDrawShadowDeclarations();
    this.fsMainBegin();
    this.fsSlicingLogic();
    this.fsLambertShadingLogic();
    this.fsDrawShadowLogic();
    this.fsOutputColor();
    this.fsMainEnd();
  }
}
