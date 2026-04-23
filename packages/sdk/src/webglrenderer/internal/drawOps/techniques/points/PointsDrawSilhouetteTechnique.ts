import {DrawTechnique} from "../../DrawTechnique";

/**
 * Draw technique for rendering point cloud silhouettes.
 * @internal
 */
export class PointsDrawSilhouetteTechnique extends DrawTechnique {

  protected readonly vertsPerPrim = 1;
  protected readonly useIndexBuffer = false;

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    this.vsSilhouetteDeclarations();
    this.vsMainBegin();
    this.vsSilhouetteLogic();
    this.vsSlicingLogic();
    this.vsMainEnd();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDeclarations();
    this.fsColorDeclarations();
    this.fsSlicingDeclarations();
    this.fsSilhouetteDeclarations();
    this.fsMainBegin();
    this.fsSlicingLogic();
    this.fsSilhouetteLogic();
    this.fsOutputColor();
    this.fsMainEnd();
  }
}
