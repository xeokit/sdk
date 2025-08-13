import {LayerRenderer} from "../LayerRenderer";
import {RenderContext} from "../../RenderContext";

/**
 * @private
 */
export class TrianglesEdgeSilhouetteRenderer extends LayerRenderer {

  constructor(renderContext: RenderContext) {
    super(renderContext, { edges: true });
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
