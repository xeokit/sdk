import {DrawTechnique} from "../../DrawTechnique";

/**
 * Draw technique for rendering triangle meshes for picking.
 * @internal
 */
export class TrianglesPickMeshDrawTechnique extends DrawTechnique {

  protected readonly vertsPerPrim = 1;
  protected readonly useIndexBuffer = false;

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefines();
    this.vsSlicingDefines();
    this.vsPickMeshDefines();
    this.vsPickMainOpen();
    this.vsPickMeshLogic();
    this.vsSlicingLogic();
    this.vsMainClose();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDefines();
    this.fsCommonDefines();
    this.fsSlicingDefines();
    this.fsPickMeshDefines();
    this.fsMainOpen();
    this.fsSlicingLogic();
    this.fsPickMeshLogic();
    this.fsCommonOutput();
    this.fsMainClose();
  }
}
