import {DrawTechnique} from "../../DrawTechnique";
import {RenderContext} from "../../../RenderContext";
import type {GPUMemoryReader} from "../../../gpuMemoryManager";

/**
 * Draw technique for rendering meshes for picking, generic for all primitive types.
 * @internal
 */
export class GenericPickMeshTechnique extends DrawTechnique {

  constructor(renderContext: RenderContext, gpuMemoryReader: GPUMemoryReader) {
    super(renderContext, gpuMemoryReader, { picking: true });
  }

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefines();
    this.vsSlicingDefines();
    this.vsPickDefines();
    this.vsPickMeshDefines();
    this.vsPickMainOpen();
    this.vsPickMeshLogic();
    this.vsSlicingLogic();
    this.vsMainClose();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDefines();
    //this.fsCommonDefines();
    this.fsSlicingDefines();
    this.fsPickMeshDefines();
    this.fsMainOpen();
    this.fsSlicingLogic();
    this.fsPickMeshLogic();
    this.fsMainClose();
  }
}
