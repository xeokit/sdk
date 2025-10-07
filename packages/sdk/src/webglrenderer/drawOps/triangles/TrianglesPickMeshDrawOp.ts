import {DrawOp} from "../DrawOp";

/**
 * @private
 */
export class TrianglesPickMeshDrawOp extends DrawOp {

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefs();
    this.vsSlicingDefines();
    this.vsPickMeshDefs();
    this.vsPickMainOpen();
    this.vsPickMeshLogic();
    this.vsSlicingLogic();
    this.vsMainClose();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDefines();
    this.fsCommonDefines();
    this.fsSlicingDefines();
    this.fsPickMeshDefs();
    this.fsMainOpen();
    this.fsSlicingLogic();
    this.fsPickMeshLogic();
    this.fsCommonOutput();
    this.fsMainClose();
  }
}
