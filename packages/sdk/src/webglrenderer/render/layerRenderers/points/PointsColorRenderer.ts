import {LayerRenderer} from "../LayerRenderer";

/**
 * @private
 */
export class PointsColorRenderer extends LayerRenderer {

  buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefines();
    this.vsDrawFlatColorDefs(); // Flat color definitions
    this.vsSlicingDefines();
    this.vsPointsDefines();
    this.vsDrawMainOpen();
    this.vsDrawFlatColorLogic(); // Flat color for points
    this.vsSlicingLogic();
    this.vsMainClose();
  }

  buildFragmentShader(): void {
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
