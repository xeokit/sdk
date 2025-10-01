import {LayerRenderer} from "../LayerRenderer";
import {RenderContext} from "../../../RenderContext";
import {GPUMemoryLayer} from "../../../gpuMemory/GPUMemoryLayer";

/**
 * @private
 */
export class TrianglesEdgeSilhouetteRenderer extends LayerRenderer {

  constructor(renderContext: RenderContext, dtxMemory:GPUMemoryLayer) {
    super(renderContext, dtxMemory, { edges: true });
  }

  buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefs();
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
    this.fsSilhouetteDefines();
    this.fsMainOpen();
    this.fsSlicingLogic();
    this.fsSilhouetteLogic();
    this.fsCommonOutput();
    this.fsMainClose();
  }
}
