import {DrawTechnique} from "../../DrawTechnique";
import {RenderContext} from "../../../RenderContext";
import {type GPUMemoryReader} from "../../../gpuMemoryManager/GPUMemoryReader";

/**
 * Snap pass — rasterises corner vertices as 1-pixel `gl.POINTS`
 * (vertex snap) or silhouette / crease edges as 1-pixel `gl.LINES`
 * (edge snap) into the snap framebuffer populated by
 * {@link TrianglesSnapInitTechnique}. Only fragments that pass the
 * depth test laid down by the init pass survive, so an occluded
 * vertex / edge never wins.
 *
 * Both modes ride the *edge* index buffer (the dihedral-angle-
 * thresholded set the renderer already maintains for outline
 * drawing) — never the triangle index buffer. That means snap-to-
 * vertex hits real geometric corners only, not the interior
 * vertices that exist purely because we triangulated a flat face;
 * snap-to-edge hits real silhouette / crease edges only, not the
 * interior diagonals shared between coplanar triangles.
 *
 * Constructor `snap` selects the mode (`1` = vertex, `2` = edge);
 * the only difference is `gl.POINTS` vs `gl.LINES` in `_draw`.
 *
 * The fragment shader writes the high-precision view-space position
 * to a single RGBA32F MRT slot with `alpha = 1.0`. JS reads back
 * the buffer and finds the nearest `alpha === 1.0` texel to the
 * cursor — that texel's view-space position is the snap target.
 *
 * @internal
 */
export class TrianglesSnapTechnique extends DrawTechnique {

  public readonly vertsPerPrim = 2;

  constructor(
    renderContext: RenderContext,
    gpuMemoryReader: GPUMemoryReader,
    snap: 1 | 2,
  ) {
    super(renderContext, gpuMemoryReader, { snap, edges: true });
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
