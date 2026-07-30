import {DrawTechnique} from "../../DrawTechnique";
import {RenderContext} from "../../../RenderContext";
import {type GPUMemoryReader} from "../../../gpuMemoryManager/GPUMemoryReader";

/**
 * Draw technique for rendering triangle mesh edges as silhouettes.
 * Uses edge index buffers (vertsPerPrim = 2) and the edge-material silhouette color uniforms.
 * @internal
 */
export class TrianglesDrawEdgeSilhouetteTechnique extends DrawTechnique {

  public readonly vertsPerPrim = 2; // edge indices are line segments

  constructor(
    renderContext: RenderContext,
    gpuMemoryReader: GPUMemoryReader,
    opts: { vboGeometry?: boolean; logDepth?: boolean } = {},
  ) {
    super(renderContext, gpuMemoryReader, {
      edges: true,
      vboGeometry: opts.vboGeometry === true,
      logDepth: opts.logDepth === true,
    });
  }

  protected buildVertexShader(): void {
    // Edges render at true depth — RenderManager's scene-phase
    // `POLYGON_OFFSET_FILL` pushes surfaces back so these lines naturally
    // win depth-test ties without needing a shader-side bias.
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    this.vsSilhouetteDeclarations();
    this.vsEdgeFadeDeclarations();
    this.vsLogDepthDeclarations();
    this.vsMainBegin();
    this.vsSilhouetteLogic();
    this.vsEdgeFadeLogic();
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
    this.fsEdgeFadeDeclarations();
    this.fsLogDepthDeclarations();
    this.fsMainBegin();
    this.fsSlicingLogic();
    this.fsSilhouetteLogic();
    this.fsEdgeFadeLogic();
    this.fsOutputColor();
    this.fsLogDepthLogic();
    this.fsMainEnd();
  }
}
