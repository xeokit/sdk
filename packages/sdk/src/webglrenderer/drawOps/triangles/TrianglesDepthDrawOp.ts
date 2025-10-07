import {DrawOp} from "../DrawOp";

/**
 * @private
 */
export class TrianglesDepthDrawOp extends DrawOp {

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefs();
    this.vsSlicingDefines();
    this.vsDrawDepthDefs();
    this.vsPickMainOpen(); // Depth rendering is always for picking
    this.vsDrawDepthLogic();
    this.vsSlicingLogic();
    this.vsMainClose();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDefines();
    this.fsCommonDefines();
    this.fsSlicingDefines();
    this.fsDrawDepthDefs();
    this.fsMainOpen();
    this.fsSlicingLogic();
    this.fsDrawDepthLogic();
    this.fsCommonOutput();
    this.fsMainClose();
  }
}
