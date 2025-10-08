import {DrawTechnique} from "../DrawTechnique";

/**
 * @private
 */
export class TrianglesPickMeshDrawTechnique extends DrawTechnique {

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
