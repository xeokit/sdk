import {DrawOp} from "../DrawOp";

/**
 * @private
 */
export class LinesSilhouetteDrawOp extends DrawOp {

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefs();
    this.vsSlicingDefines();
    this.vsSilhouetteDefines();
    this.vsSilhouetteMainOpen();
    this.vsSilhouetteLogic();
    this.vsSlicingLogic();
    this.vsMainClose();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDefines();
    this.fsCommonDefines();
    this.fsSlicingDefines();
    this.fsSilhouetteDefines();
    this.fsMainOpen();
    this.fsSlicingLogic();
    this.fsSilhouetteLogic();
    this.fsCommonOutput();
    this.fsMainClose();
  }
}
