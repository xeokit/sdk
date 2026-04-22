import {DrawTechnique} from "../../DrawTechnique";

/**
 * Draw technique for rendering point silhouettes.
 * @internal
 */
export class PointsDrawSilhouetteTechnique extends DrawTechnique {

  protected readonly vertsPerPrim = 1;
  protected readonly useIndexBuffer = false;

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefines();
    this.vsSlicingDefines();
    this.vsSilhouetteDefines();
    this.vsMainOpen();
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
