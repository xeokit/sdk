import {DrawTechnique} from "../../DrawTechnique";

/**
 * Draw technique for rendering silhouettes — generic across all primitive types.
 * @internal
 */
export class GenericDrawSilhouetteTechnique extends DrawTechnique {

  public readonly vertsPerPrim: number;

  constructor(renderContext, gpuMemoryReader, vertsPerPrim: number) {
    super(renderContext, gpuMemoryReader);
    this.vertsPerPrim = vertsPerPrim;
  }

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    this.vsSilhouetteDeclarations();
    this.vsMainBegin();
    this.vsSilhouetteLogic();
    this.vsSlicingLogic();
    this.vsMainEnd();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDeclarations();
    this.fsColorDeclarations();
    this.fsSlicingDeclarations();
    this.fsSilhouetteDeclarations();
    this.fsMainBegin();
    this.fsSlicingLogic();
    this.fsSilhouetteLogic();
    this.fsOutputColor();
    this.fsMainEnd();
  }
}
