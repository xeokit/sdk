import {DrawTechnique} from "../../DrawTechnique";
import {RenderContext} from "../../../RenderContext";
import {DTXMemoryReader} from "../../../dtxMemory/DTXMemoryReader";

/**
 * @private
 */
export class TrianglesEdgeSilhouetteDrawTechnique extends DrawTechnique {

  constructor(renderContext: RenderContext, dtxMemoryReader: DTXMemoryReader) {
    super(renderContext, dtxMemoryReader, { edges: true });
  }

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDefines();
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
