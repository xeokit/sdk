import {DrawTechnique} from "../../DrawTechnique";

/**
 * Renderer for drawing lines with color in the `WebGLRenderer`.
 *
 * @private
 */
export class LinesDrawColorTechnique extends DrawTechnique {

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefines();
    this.vsDrawFlatColorDefs();
    this.vsSlicingDefines();
    this.vsMainOpen();
    this.vsDrawFlatColorLogic(); // Flat color for lines
    this.vsSlicingLogic();
    this.vsMainClose();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDefines();
    this.fsCommonDefines();
    this.fsSlicingDefines();
    this.fsDrawFlatColorDefines();
    this.fsMainOpen();
    this.fsSlicingLogic();
    this.fsDrawFlatColorLogic();
    this.fsCommonOutput();
    this.fsMainClose();
  }
}
