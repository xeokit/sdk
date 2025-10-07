import {DrawOp} from "../DrawOp";

/**
 * Renderer for drawing lines with color in the `WebGLRenderer`.
 *
 * @private
 */
export class LinesColorDrawOp extends DrawOp {

  /**
   * Builds the vertex shader for rendering lines.
   */
  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefs();
    this.vsDrawFlatColorDefs();
    this.vsSlicingDefines();
    this.vsDrawMainOpen();
    this.vsDrawFlatColorLogic(); // Flat color for lines
    this.vsSlicingLogic();
    this.vsMainClose();
  }

  /**
   * Builds the fragment shader for rendering lines.
   */
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
