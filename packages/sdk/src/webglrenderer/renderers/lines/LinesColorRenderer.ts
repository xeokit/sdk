import {LayerRenderer} from "../LayerRenderer";

/**
 * Renderer for drawing lines with color in the `WebGLRenderer`.
 *
 * @private
 */
export class LinesColorRenderer extends LayerRenderer {

  /**
   * Builds the vertex shader for rendering lines.
   */
  buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefines();
    this.vsSlicingDefines();
    this.vsDrawMainOpen();
    this.vsDrawFlatColorLogic(); // Flat color for lines
    this.vsSlicingLogic();
    this.vsMainClose();
  }

  /**
   * Builds the fragment shader for rendering lines.
   */
  buildFragmentShader(): void {
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
