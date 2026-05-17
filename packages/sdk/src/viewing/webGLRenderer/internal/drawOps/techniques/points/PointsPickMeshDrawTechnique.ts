import {DrawTechnique} from "../../DrawTechnique";

/**
 * Draw technique for rendering point cloud meshes into the pick framebuffer.
 * @internal
 */
export class TrianglesPickMeshDrawTechnique extends DrawTechnique {

  public readonly vertsPerPrim = 1;
  protected readonly useIndexBuffer = false;

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    this.vsPickDeclarations();
    this.vsPickMainBegin();
    this.vsPickMeshLogic();
    this.vsSlicingLogic();
    this.vsMainEnd();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDeclarations();
    // Pick techniques use MRT outputs declared by fsPickMeshDeclarations(),
    // so fsColorDeclarations() is intentionally omitted here.
    this.fsSlicingDeclarations();
    this.fsPickMeshDeclarations();
    this.fsMainBegin();
    this.fsSlicingLogic();
    this.fsPickMeshLogic();
    this.fsMainEnd();
  }
}
