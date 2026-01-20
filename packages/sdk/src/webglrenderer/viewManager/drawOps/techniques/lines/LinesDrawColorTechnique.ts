import {DrawTechnique} from "../../DrawTechnique";

/**
 * Draw technique for rendering lines with a flat color.
 *
 * @internal
 */
export class LinesDrawColorTechnique extends DrawTechnique {

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefines();
    this.vsDrawFlatColorDefs();
    this.vsSlicingDefines();
    this.vsMainOpen();
    this.vsDrawFlatColorLogic(); // Flat color for lines
    this.vsSlicingLogic();
    this.vsMainClose();
  }

  protected buildFragmentShader(): void {
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
