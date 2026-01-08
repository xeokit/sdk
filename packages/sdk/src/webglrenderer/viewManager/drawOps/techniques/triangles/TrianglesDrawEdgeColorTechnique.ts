import {DrawTechnique} from "../../DrawTechnique";
import {RenderContext} from "../../../RenderContext";
import {type GPUMemoryReader} from "../../../gpuMemoryManager/GPUMemoryReader";

/**
 * @internal
 */
export class TrianglesDrawEdgeColorTechnique extends DrawTechnique {

  constructor(renderContext: RenderContext, gpuMemoryReader: GPUMemoryReader) {
    super(renderContext, gpuMemoryReader, { edges: true });
  }

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
