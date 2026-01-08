import {DrawTechnique} from "../../DrawTechnique";

/**
 * @internal
 */
export class GenericPickDepthTechnique extends DrawTechnique {

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefines();
    this.vsSlicingDefines();
    this.vsDrawDepthDefines();
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
    this.fsDrawDepthDefines();
    this.fsMainOpen();
    this.fsSlicingLogic();
    this.fsDrawDepthLogic();
    this.fsCommonOutput();
    this.fsMainClose();
  }
}
