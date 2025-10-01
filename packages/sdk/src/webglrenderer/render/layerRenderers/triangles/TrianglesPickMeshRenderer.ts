import {LayerRenderer} from "../LayerRenderer";

/**
 * @private
 */
export class TrianglesPickMeshRenderer extends LayerRenderer {

  buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefs();
    this.vsSlicingDefines();
    this.vsPickMeshDefs();
    this.vsPickMainOpen();
    this.vsPickMeshLogic();
    this.vsSlicingLogic();
    this.vsMainClose();
  }

  buildFragmentShader(): void {
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
