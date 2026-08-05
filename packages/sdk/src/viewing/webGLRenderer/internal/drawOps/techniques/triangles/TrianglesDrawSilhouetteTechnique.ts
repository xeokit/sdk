import {DrawTechnique} from "../../DrawTechnique";

/**
 * Draw technique for rendering triangle mesh silhouettes (xray / highlight / selected fill).
 * Applies a flat uniform color over all triangles; no lighting is computed.
 * @internal
 */
export class TrianglesDrawSilhouetteTechnique extends DrawTechnique {

  public readonly vertsPerPrim = 3;

  constructor(
    renderContext,
    gpuMemoryReader,
    opts: { vboGeometry?: boolean; vboTileUniform?: boolean; vboViewAttributes?: boolean; logDepth?: boolean } = {},
  ) {
    super(renderContext, gpuMemoryReader, {
      vboGeometry: opts.vboGeometry === true,
      vboTileUniform: opts.vboTileUniform === true,
      vboViewAttributes: opts.vboViewAttributes === true,
      logDepth: opts.logDepth === true,
    });
  }

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    this.vsSilhouetteDeclarations();
    this.vsLogDepthDeclarations();
    this.vsMainBegin();
    this.vsSilhouetteLogic();
    this.vsSlicingLogic();
    this.vsLogDepthLogic();
    this.vsMainEnd();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDeclarations();
    this.fsColorDeclarations();
    this.fsSlicingDeclarations();
    this.fsSilhouetteDeclarations();
    this.fsLogDepthDeclarations();
    this.fsMainBegin();
    this.fsSlicingLogic();
    this.fsSilhouetteLogic();
    this.fsOutputColor();
    this.fsLogDepthLogic();
    this.fsMainEnd();
  }
}
