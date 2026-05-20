import {DrawTechnique} from "../../DrawTechnique";

/**
 * Draw technique for rendering triangles with a flat (per-mesh) color and
 * **no Lambert / PBR lighting** — the fragment colour is exactly the mesh's
 * own colour, modulated only by the standard premultiplied-alpha output.
 *
 * Used by the renderer's overlay-bin pass (gizmos, HUD chrome and other
 * "floating UI" content) so the handles read as solid pure colour against
 * the lit scene behind them, instead of darkening on faces angled away
 * from the lights. Mirrors {@link LinesDrawColorTechnique} — same shader
 * skeleton, just with `vertsPerPrim = 3` for the triangle dispatch.
 *
 * **No section-plane clipping.** Overlay-bin content is conceptually
 * out-of-band UI (TransformControls handles, section-plane proxy quads,
 * etc.) and should never disappear behind a user-placed cutting plane.
 * The slicing helpers are intentionally omitted from both the VS and FS
 * here — the technique never reads `uSectionPlanes` and the VS never
 * emits the `vWorldPos` / `vClippable` varyings. The cost is a couple
 * fewer instructions per vertex and zero fragment-side discards; the
 * benefit is a categorical "overlay ignores section planes" rule that
 * new overlay-bin authors get for free.
 *
 * @internal
 */
export class TrianglesDrawColorFlatTechnique extends DrawTechnique {

  public readonly vertsPerPrim = 3;

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsDrawFlatColorDeclarations();
    this.vsLogDepthDeclarations();
    this.vsMainBegin();
    this.vsDrawFlatColorLogic();
    this.vsLogDepthLogic();
    this.vsMainEnd();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDeclarations();
    this.fsColorDeclarations();
    this.fsDrawFlatColorDeclarations();
    this.fsMainBegin();
    this.fsDrawFlatColorLogic();
    // Overlay-bin batches drawn by this technique render straight
    // to the default canvas AFTER `PostProcessChain.composite`,
    // bypassing the tonemap shader that elsewhere does the sRGB
    // encode. Apply the same gamma-2.2 curve inline so colours
    // land in the same encoded space as the rest of the canvas.
    this.fsSRGBEncodeColor();
    this.fsOutputColor();
    this.fsMainEnd();
  }
}
