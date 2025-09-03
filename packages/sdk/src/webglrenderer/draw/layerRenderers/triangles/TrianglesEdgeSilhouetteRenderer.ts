import {LayerRenderer} from "../LayerRenderer";
import {RenderContext} from "../../../RenderContext";
import {GPUMemory} from "../../../memory/GPUMemory";

/**
 * @private
 */
export class TrianglesEdgeSilhouetteRenderer extends LayerRenderer {

  constructor(renderContext: RenderContext, dtxMemory:GPUMemory) {
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
    this.fsSilhouetteDefines();
    this.fsMainOpen();
    this.fsSlicingLogic();
    this.fsSilhouetteLogic();
    this.fsCommonOutput();
    this.fsMainClose();
  }
}
