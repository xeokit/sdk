import {DrawTechnique} from "../../DrawTechnique";
import type {GPUMemoryReader} from "../../../gpuMemoryManager/GPUMemoryReader";
import type {RenderContext} from "../../../RenderContext";


/**
 * Pick technique for thick lines — rasterises the same
 * quad-expanded geometry as {@link ThickLinesDrawColorTechnique}
 * (six vertices per line, screen-space perpendicular offset,
 * round caps, miter joints) but writes the pick-MRT triple
 * (`batchIndex`, `meshIndex`, packed depth) rather than a
 * shaded colour.
 *
 * Without this technique, picking a thick line would fall back
 * to the legacy 1-pixel `gl.LINES` path and miss every pixel
 * inside the line's body that wasn't on the centreline — users
 * see a 4-pixel-wide line but can only click on the 1-pixel
 * core. With it, the entire visible rounded-rectangle body is
 * pickable. The cap-extension corners of the quad sit outside
 * the rounded rectangle and are discarded by
 * {@link DrawTechnique.fsThickLineDiscardOutside} so the
 * pickable region matches the visible silhouette exactly.
 *
 * `vertsPerPrim` is `6` so the base class's `_draw` switch
 * routes through `gl.drawArrays(gl.TRIANGLES, …, n × 6)`.
 *
 * @internal
 */
export class ThickLinesPickMeshTechnique extends DrawTechnique {

  public readonly vertsPerPrim = 6;

  constructor(renderContext: RenderContext, gpuMemoryReader: GPUMemoryReader) {
    super(renderContext, gpuMemoryReader, {picking: true, thickLines: true});
  }

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    // vsPickDeclarations declares `drawingBufferSize`, so the
    // thick-line declarations skip their own copy to avoid a
    // duplicate-uniform compile error.
    this.vsPickDeclarations();
    this.vsThickLineDeclarations(true);
    // vsThickLineMain opens main() itself and leaves `meshIndex`,
    // `viewPos`, and `gl_Position` in scope — vsPickMeshLogic
    // consumes those to write the pick varyings and remap the
    // clip-space position into the pick FBO's tiny viewport.
    this.vsThickLineMain();
    this.vsPickMeshLogic();
    this.vsSlicingLogic();
    this.vsMainEnd();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDeclarations();
    // Pick techniques declare their own MRT outputs via
    // fsPickMeshDeclarations() — no fsColorDeclarations() here.
    this.fsSlicingDeclarations();
    this.fsPickMeshDeclarations();
    this.fsThickLineDeclarations();
    this.fsMainBegin();
    this.fsSlicingLogic();
    // Discard fragments outside the line's rounded-rectangle
    // body BEFORE writing the pick IDs, so the cap-extension
    // corners of the quad don't poison neighbouring pixels of
    // the pick buffer.
    this.fsThickLineDiscardOutside();
    this.fsPickMeshLogic();
    this.fsMainEnd();
  }
}
