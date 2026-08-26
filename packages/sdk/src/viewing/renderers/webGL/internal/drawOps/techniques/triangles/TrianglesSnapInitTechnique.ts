import {DrawTechnique} from "../../DrawTechnique";
import {RenderContext} from "../../../RenderContext";
import {type GPUMemoryReader} from "../../../gpuMemoryManager/GPUMemoryReader";

/**
 * Snap-init pass — rasterises triangle surfaces into the snap framebuffer
 * to populate its depth + view-position outputs. Lays down the depth
 * baseline the subsequent {@link TrianglesSnapTechnique} z-tests vertex
 * and edge primitives against, so an occluded vertex/edge never wins
 * the snap.
 *
 * Same pipeline as the colour pass but routed through the snap clip-pos
 * remapping (a small viewport centred on the cursor) and a single
 * RGBA32F MRT output carrying view-space position.
 *
 * @internal
 */
export class TrianglesSnapInitTechnique extends DrawTechnique {

  public readonly vertsPerPrim = 3;

  constructor(
    renderContext: RenderContext,
    gpuMemoryReader: GPUMemoryReader,
    opts: { vboGeometry?: boolean; vboTileUniform?: boolean; vboViewAttributes?: boolean } = {},
  ) {
    super(renderContext, gpuMemoryReader, {
      snap: 3,
      vboGeometry: opts.vboGeometry === true,
      vboTileUniform: opts.vboTileUniform === true,
      vboViewAttributes: opts.vboViewAttributes === true
    });
  }

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    this.vsSnapDeclarations();
    this.vsMainBegin();
    this.vsSnapLogic();
    this.vsSlicingLogic();
    this.vsMainEnd();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDeclarations();
    // Snap techniques declare their own MRT slot via fsSnapDeclarations();
    // fsColorDeclarations() is intentionally omitted.
    this.fsSlicingDeclarations();
    this.fsSnapDeclarations();
    this.fsMainBegin();
    this.fsSlicingLogic();
    this.fsSnapLogic();
    this.fsMainEnd();
  }
}
