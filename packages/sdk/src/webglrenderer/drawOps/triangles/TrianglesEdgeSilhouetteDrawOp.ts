import {DrawOp} from "../DrawOp";
import {RenderContext} from "../../RenderContext";
import {GPUMemoryBatch} from "../../gpuMemory/GPUMemoryBatch";

/**
 * @private
 */
export class TrianglesEdgeSilhouetteDrawOp extends DrawOp {

  constructor(renderContext: RenderContext, dtxMemory:GPUMemoryBatch) {
    super(renderContext, dtxMemory, { edges: true });
  }

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefs();
    this.vsSlicingDefines();
    this.vsSilhouetteDefines();
    this.vsSilhouetteMainOpen();
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
