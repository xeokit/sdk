import {DrawTechnique} from "../../DrawTechnique";

/**
 * Draw technique for rendering point cloud depth into the pick framebuffer.
 * @internal
 */
export class PointsPickDepth extends DrawTechnique {

  protected readonly vertsPerPrim = 1;
  protected readonly useIndexBuffer = false;

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    this.vsDrawDepthDeclarations();
    this.vsPickMainBegin();
    this.vsDrawDepthLogic();
    this.vsSlicingLogic();
    this.vsMainEnd();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDeclarations();
    this.fsColorDeclarations();
    this.fsSlicingDeclarations();
    this.fsDrawDepthDeclarations();
    this.fsMainBegin();
    this.fsSlicingLogic();
    this.fsDrawDepthLogic();
    this.fsOutputColor();
    this.fsMainEnd();
  }
}
