import {DrawTechnique} from "../../DrawTechnique";

/**
 * @internal
 */
export class TrianglesDrawColorTechnique extends DrawTechnique {

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefines();
    this.vsSlicingDefines();
    this.vsLambertShadingDefines();
    this.vsMainOpen();
    this.vsLambertShadingLogic();
    this.vsSlicingLogic();
   this.vsMainClose();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDefines();
    this.fsCommonDefines();
    this.fsSlicingDefines();
    this.fsLambertShadingDefines();
    this.fsMainOpen();
    this.fsSlicingLogic();
    this.fsLambertShadingLogic();
    this.fsCommonOutput();
    this.fsMainClose();
  }
}
