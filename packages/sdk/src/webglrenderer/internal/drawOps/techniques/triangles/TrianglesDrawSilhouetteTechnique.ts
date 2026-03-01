import {DrawTechnique} from "../../DrawTechnique";

/**
 * Draw technique for rendering generic silhouettes.
 * @internal
 */
export class TrianglesDrawSilhouetteTechnique extends DrawTechnique {

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefines();
    this.vsSlicingDefines();
    this.vsLambertShadingDefines(true /** Silhouette */);
    this.vsMainOpen();
    this.vsLambertShadingLogic(true /** Silhouette */);
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
