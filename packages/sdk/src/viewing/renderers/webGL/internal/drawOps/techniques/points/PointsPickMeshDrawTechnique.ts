import {DrawTechnique} from "../../DrawTechnique";
import type {GPUMemoryReader} from "../../../gpuMemoryManager/GPUMemoryReader";
import type {RenderContext} from "../../../RenderContext";

/**
 * Draw technique for rendering point cloud meshes into the pick framebuffer.
 * @internal
 */
export class PointsPickMeshTechnique extends DrawTechnique {

  public readonly vertsPerPrim = 1;
  protected readonly useIndexBuffer = false;

  constructor(renderContext: RenderContext, gpuMemoryReader: GPUMemoryReader) {
    super(renderContext, gpuMemoryReader, {picking: true});
  }

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    this.vsPickDeclarations();
    this.vsPointsDeclarations();
    this.vsPickMainBegin();
    this.vsPickMeshLogic();
    this.vsPointsPickGeometryLogic();
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
