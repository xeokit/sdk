import {LayerRenderer} from "../LayerRenderer";
import {RenderContext} from "../../RenderContext";
import {GPUDataMemory} from "../../gpuMemory/GPUDataMemory";

/**
 * @private
 */
export class TrianglesEdgeSilhouetteRenderer extends LayerRenderer {

  constructor(renderContext: RenderContext, dtxMemory:GPUDataMemory) {
    super(renderContext, dtxMemory, { edges: true });
  }

  buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefines();
    this.vsSlicingDefines();
    this.vsSilhouetteDefines();
    this.vsSilhouetteMainOpen();
    this.vsSilhouetteLogic();
    this.vsSlicingLogic();
    this.vsMainClose();
  }

  buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDefines();
    this.fsCommonDefines();
    this.fsSlicingDefines();
    this.fsSilhouetteDefs();
    this.fsMainOpen();
    this.fsSlicingLogic();
    this.fsSilhouetteLogic();
    this.fsCommonOutput();
    this.fsMainClose();
  }
}
