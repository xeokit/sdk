import {DrawTechnique} from "../../DrawTechnique";
import {RenderContext} from "../../../RenderContext";
import {type GPUMemoryReader} from "../../../gpuMemoryManager/GPUMemoryReader";

/**
 * Draw technique for rendering triangle mesh edges with a silhouette color.
 * Uses edge index buffers (vertsPerPrim = 2) and the edge-material color uniforms.
 * @internal
 */
export class TrianglesDrawEdgeColorTechnique extends DrawTechnique {

  protected readonly vertsPerPrim = 2; // edge indices are line segments

  constructor(renderContext: RenderContext, gpuMemoryReader: GPUMemoryReader) {
    super(renderContext, gpuMemoryReader, { edges: true });
  }

  protected buildVertexShader(): void {
    // Edges render at true depth. The scene-phase `POLYGON_OFFSET_FILL` in
    // RenderManager pushes triangle surfaces back in a slope-aware way, so
    // lines (unaffected by that GL state) naturally win depth-test ties
    // without needing a shader-side bias.
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    this.vsSilhouetteDeclarations();
    this.vsEdgeFadeDeclarations();
    this.vsMainBegin();
    this.vsSilhouetteLogic();
    this.vsEdgeFadeLogic();
    this.vsSlicingLogic();
    this.vsMainEnd();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDeclarations();
    this.fsColorDeclarations();
    this.fsSlicingDeclarations();
    this.fsSilhouetteDeclarations();
    this.fsEdgeFadeDeclarations();
    this.fsMainBegin();
    this.fsSlicingLogic();
    this.fsSilhouetteLogic();
    this.fsEdgeFadeLogic();
    this.fsOutputColor();
    this.fsMainEnd();
  }
}
