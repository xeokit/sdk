import {DrawTechnique} from "../../DrawTechnique";

/**
 * Draw technique for rendering colored triangles with Lambert shading.
 * @internal
 */
export class TrianglesDrawColorTechnique extends DrawTechnique {

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
    this.fsMainBegin();
    this.fsSlicingLogic();
    this.fsLambertShadingLogic();
    this.fsOutputColor();
    this.fsMainEnd();
  }
}
