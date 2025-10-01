import {LayerRenderer} from "../LayerRenderer";

/**
 * @private
 */
export class TrianglesColorRenderer extends LayerRenderer {

  buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefs();
    this.vsSlicingDefines();
    this.vsDrawLambertDefs();
    this.vsDrawMainOpen();
    this.vsDrawLambertLogic(); // Lambert shading for triangles
    this.vsSlicingLogic();
    this.vsMainClose();
  }

  buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDefines();
    this.fsCommonDefines();
    this.fsSlicingDefines();
    this.fsDrawLambertDefs(); // Lambert shading definitions
    this.fsMainOpen();
    this.fsSlicingLogic();
    this.fsDrawLambertLogic(); // Lambert shading logic
    this.fsCommonOutput();
    this.fsMainClose();
  }
}
