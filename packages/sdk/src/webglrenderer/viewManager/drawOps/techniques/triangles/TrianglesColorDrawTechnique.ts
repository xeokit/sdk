import {DrawTechnique} from "../../DrawTechnique";

/**
 * @private
 */
export class TrianglesColorDrawTechnique extends DrawTechnique {

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefines();
    this.vsSlicingDefines();
    this.vsDrawLambertDefs();
    this.vsDrawMainOpen();
    this.vsDrawLambertLogic(); // Lambert shading for triangles
    this.vsSlicingLogic();
    this.vsMainClose();
  }

  protected buildFragmentShader(): void {
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
