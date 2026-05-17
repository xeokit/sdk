import {DrawTechnique} from "../../DrawTechnique";

/**
 * Draw technique for rendering lines with a flat (per-mesh) color.
 * @internal
 */
export class LinesDrawColorTechnique extends DrawTechnique {

  public readonly vertsPerPrim = 2;

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    this.vsDrawFlatColorDeclarations();
    this.vsMainBegin();
    this.vsDrawFlatColorLogic();
    this.vsSlicingLogic();
    this.vsMainEnd();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDeclarations();
    this.fsColorDeclarations();
    this.fsSlicingDeclarations();
    this.fsDrawFlatColorDeclarations();
    this.fsMainBegin();
    this.fsSlicingLogic();
    this.fsDrawFlatColorLogic();
    this.fsOutputColor();
    this.fsMainEnd();
  }
}
