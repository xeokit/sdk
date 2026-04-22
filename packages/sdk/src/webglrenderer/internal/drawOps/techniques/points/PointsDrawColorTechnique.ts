import {DrawTechnique} from "../../DrawTechnique";

/**
 * Draw technique for rendering colored points.
 * @internal
 */
export class PointsDrawColorTechnique extends DrawTechnique {

  protected readonly vertsPerPrim = 1;
  protected readonly useIndexBuffer = false;

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefines();
    this.vsDrawVertexColorDefs(); // Flat color definitions
    this.vsSlicingDefines();
    this.vsPointsDefines();
    this.vsMainOpen();
    this.vsDrawVertexColorLogic(); // Vertex colors for points
    this.vsSlicingLogic();
    this.vsPointsGeometryLogic();
    this.vsMainClose();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDefines();
    this.fsCommonDefines();
    this.fsSlicingDefines();
    this.fsPointsDefines();
    this.fsDrawFlatColorDefines(); // Flat color definitions
    this.fsMainOpen();
    this.fsSlicingLogic();
    this.fsPointsGeometryLogic();
    this.fsDrawFlatColorLogic(); // Flat color logic
    this.fsCommonOutput();
    this.fsMainClose();
  }
}
