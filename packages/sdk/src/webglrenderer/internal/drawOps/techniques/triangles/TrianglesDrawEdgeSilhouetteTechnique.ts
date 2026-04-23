import {DrawTechnique} from "../../DrawTechnique";
import {RenderContext} from "../../../RenderContext";
import {type GPUMemoryReader} from "../../../gpuMemoryManager/GPUMemoryReader";

/**
 * Draw technique for rendering triangle mesh edges as silhouettes.
 * Uses edge index buffers (vertsPerPrim = 2) and the edge-material silhouette color uniforms.
 * @internal
 */
export class TrianglesDrawEdgeSilhouetteTechnique extends DrawTechnique {

  protected readonly vertsPerPrim = 2; // edge indices are line segments

  constructor(renderContext: RenderContext, gpuMemoryReader: GPUMemoryReader) {
    super(renderContext, gpuMemoryReader, { edges: true });
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
