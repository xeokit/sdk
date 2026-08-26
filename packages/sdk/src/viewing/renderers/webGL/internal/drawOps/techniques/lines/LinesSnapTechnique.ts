import {DrawTechnique} from "../../DrawTechnique";
import {RenderContext} from "../../../RenderContext";
import {type GPUMemoryReader} from "../../../gpuMemoryManager/GPUMemoryReader";


/**
 * Snap pass for {@link LinesPrimitive} batches — rasterises each
 * line's endpoints as 1-pixel `gl.POINTS` (vertex snap, `snap = 1`)
 * or each line as a 1-pixel `gl.LINES` segment (edge snap,
 * `snap = 2`) into the snap framebuffer.
 *
 * Unlike {@link TrianglesSnapTechnique}, which rides the
 * dihedral-angle-thresholded *edge* index buffer (triangle meshes
 * carry both a triangle index buffer for surfaces and a separate
 * edge index buffer for silhouette / crease lines), line batches
 * only ever carry their *line* index buffer — the lines themselves
 * already are the edges. `edges` is `false` here so
 * `_vsMeshLogic2` fetches from `indicesBase`, and `_draw` reads
 * `pickPrimitiveRange` rather than `pickEdgePrimitiveRange`.
 *
 * The snap target is the centerline of each line — no quad
 * expansion. Users see a thick line (drawn through the quad-
 * expanded {@link ThickLinesDrawColorTechnique}) but snap to the
 * mathematical centerline; the snap-radius window in
 * {@link SnapManager} catches clicks anywhere within `snapRadius`
 * pixels of the cursor.
 *
 * Constructor `snap` selects the mode; the only runtime difference
 * is `gl.POINTS` vs `gl.LINES` in the base technique's `_draw`.
 *
 * @internal
 */
export class LinesSnapTechnique extends DrawTechnique {

  public readonly vertsPerPrim = 2;

  constructor(
    renderContext: RenderContext,
    gpuMemoryReader: GPUMemoryReader,
    snap: 1 | 2,
  ) {
    super(renderContext, gpuMemoryReader, {snap, edges: false});
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
    this.fsSlicingDeclarations();
    this.fsSnapDeclarations();
    this.fsMainBegin();
    this.fsSlicingLogic();
    this.fsSnapLogic();
    this.fsMainEnd();
  }
}
