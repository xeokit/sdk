import {DrawTechnique} from "../../DrawTechnique";

/**
 * Draw technique for rendering colored point clouds.
 * @internal
 */
export class PointsDrawColorTechnique extends DrawTechnique {

  public readonly vertsPerPrim = 1;
  protected readonly useIndexBuffer = false;

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    this.vsDrawVertexColorDeclarations();
    this.vsPointsDeclarations();
    this.vsMainBegin();
    this.vsDrawVertexColorLogic();
    this.vsSlicingLogic();
    this.vsPointsGeometryLogic();
    this.vsMainEnd();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDeclarations();
    this.fsColorDeclarations();
    this.fsSlicingDeclarations();
    this.fsPointsDeclarations();
    this.fsDrawFlatColorDeclarations();
    this.fsMainBegin();
    this.fsSlicingLogic();
    this.fsPointsGeometryLogic();
    this.fsDrawFlatColorLogic();
    this.fsOutputColor();
    this.fsMainEnd();
  }
}
