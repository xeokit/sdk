import {DrawTechnique} from "../../DrawTechnique";

/**
 * @internal
 */
export class PointsDrawColorTechnique extends DrawTechnique {

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefines();
    this.vsDrawVertexColorDefs(); // Flat color definitions
    this.vsSlicingDefines();
    this.vsPointsDefines();
    this.vsMainOpen();
    this.vsDrawVertexColorLogic(); // Vertex colors for points
    this.vsSlicingLogic();
    this.vsMainClose();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDefines();
    this.fsCommonDefines();
    this.fsSlicingDefines();
    this.fsDrawFlatColorDefines(); // Flat color definitions
    this.fsMainOpen();
    this.fsSlicingLogic();
    this.fsDrawFlatColorLogic(); // Flat color logic
    this.fsCommonOutput();
    this.fsMainClose();
  }
}
