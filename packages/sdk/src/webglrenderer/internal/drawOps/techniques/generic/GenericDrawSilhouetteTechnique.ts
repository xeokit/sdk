import {DrawTechnique} from "../../DrawTechnique";

/**
 * Draw technique for rendering generic silhouettes.
 * @internal
 */
export class GenericDrawSilhouetteTechnique extends DrawTechnique {

  protected readonly vertsPerPrim: number;

  constructor(renderContext, gpuMemoryReader, vertsPerPrim: number) {
    super(renderContext, gpuMemoryReader);
    this.vertsPerPrim = vertsPerPrim;
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
