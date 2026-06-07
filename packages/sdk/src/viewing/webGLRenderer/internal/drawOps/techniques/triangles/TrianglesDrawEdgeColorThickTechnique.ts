import {DrawTechnique} from "../../DrawTechnique";
import {RenderContext} from "../../../RenderContext";
import {type GPUMemoryReader} from "../../../gpuMemoryManager/GPUMemoryReader";

/**
 * Thick (quad-expanded) variant of {@link TrianglesDrawEdgeColorTechnique}.
 *
 * `gl.lineWidth > 1` is clamped to 1 by ANGLE (and most WebGL stacks), so wide
 * base edges are drawn the same way thick lines are: each edge segment in the
 * triangle mesh's edge-index buffer expands to a two-triangle quad in
 * `vsThickLineMain` (reusing that machinery, but reading `edgeIndicesBase`),
 * with a round-rect SDF for antialiasing. Width comes from
 * `View.effects.edges.edgeWidth` via `uLineWidth`.
 *
 * Used only when `edgeWidth > 1`; at width 1 the renderer keeps the cheaper thin
 * `gl.LINES` path. The colour path (silhouette uniform / darkened mesh colour)
 * and edge fade match the thin technique so the two look identical bar thickness.
 *
 * @internal
 */
export class TrianglesDrawEdgeColorThickTechnique extends DrawTechnique {

  public readonly vertsPerPrim = 6; // each edge expands to a 2-triangle quad

  constructor(
    renderContext: RenderContext,
    gpuMemoryReader: GPUMemoryReader,
    opts: { logDepth?: boolean } = {},
  ) {
    super(renderContext, gpuMemoryReader, {
      edges: true,
      thickLines: true,
      logDepth: opts.logDepth === true,
    });
  }

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    this.vsSilhouetteDeclarations();
    this.vsEdgeFadeDeclarations();
    this.vsThickLineDeclarations();
    this.vsLogDepthDeclarations();
    this.vsThickLineMain();      // opens main(), resolves mesh/edge + quad expansion
    this.vsSilhouetteLogic();    // vColor from uSilhouetteColor / darkened mesh colour
    this.vsEdgeFadeLogic();      // vEdgeViewDist from viewPos (set by vsThickLineMain)
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
    this.fsThickLineDeclarations();
    this.fsLogDepthDeclarations();
    this.fsMainBegin();
    this.fsSlicingLogic();
    this.fsSilhouetteLogic();    // color = vColor
    this.fsThickLineLogic();     // color.a *= round-rect SDF coverage (AA)
    this.fsEdgeFadeLogic();      // color.a *= distance fade
    this.fsOutputColor();
    this.fsLogDepthLogic();
    this.fsMainEnd();
  }
}
