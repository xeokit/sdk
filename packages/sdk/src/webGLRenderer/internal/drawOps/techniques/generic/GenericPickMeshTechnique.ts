import {DrawTechnique} from "../../DrawTechnique";
import {RenderContext} from "../../../RenderContext";
import type {GPUMemoryReader} from "../../../gpuMemoryManager";

/**
 * Draw technique for rendering meshes into the pick framebuffer — generic across all primitive types.
 * @internal
 */
export class GenericPickMeshTechnique extends DrawTechnique {

  protected readonly vertsPerPrim: number;

  constructor(renderContext: RenderContext, gpuMemoryReader: GPUMemoryReader, vertsPerPrim: number) {
    super(renderContext, gpuMemoryReader, { picking: true });
    this.vertsPerPrim = vertsPerPrim;
  }

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
