import {DrawTechnique} from "../../DrawTechnique";

/**
 * Draw technique for rendering colored triangles with Lambert shading and SAO occlusion.
 * @internal
 */
export class TrianglesDrawColorSAOTechnique extends DrawTechnique {

  protected readonly vertsPerPrim = 3;

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    this.vsLambertShadingDeclarations();
    this.vsMainBegin();
    this.vsLambertShadingLogic();
    this.vsSlicingLogic();
    this.vsMainEnd();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDeclarations();
    this.fsColorDeclarations();
    this.fsSlicingDeclarations();
    this.fsLambertShadingDeclarations();
    this.fsDrawSAODeclarations();
    this.fsMainBegin();
    this.fsSlicingLogic();
    this.fsLambertShadingLogic();
    this.fsDrawSAOLogic();
    this.fsOutputColor();
    this.fsMainEnd();
  }
}
