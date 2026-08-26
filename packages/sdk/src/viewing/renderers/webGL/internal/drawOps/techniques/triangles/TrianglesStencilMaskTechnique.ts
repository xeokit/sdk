import {DrawTechnique} from "../../DrawTechnique";

/**
 * Stencil-mask draw technique used by the section-plane cap pass.
 *
 * Reuses the standard mesh/transform vertex pipeline so every batch
 * the colour pass would draw is also visited here. The FS does no
 * colour or depth work — it just decides whether a fragment should
 * `discard` or pass through. RenderManager wraps the draw with:
 *
 *   - `colorMask(false, ...)` + `depthMask(false)` — the pass writes
 *     stencil only.
 *   - `cullFace(BACK)` + `stencilOp(KEEP, KEEP, DECR_WRAP)` on the
 *     first invocation (front-face entry counts).
 *   - `cullFace(FRONT)` + `stencilOp(KEEP, KEEP, INCR_WRAP)` on the
 *     second invocation (back-face exit counts).
 *
 * After both invocations, stencil != 0 at any pixel where the
 * camera ray enters the model past the cap plane and exits past it
 * too — i.e. the cap plane is INSIDE the model at that pixel. A
 * cap quad drawn on the plane with `stencilFunc(NOTEQUAL, 0)`
 * paints capColor only on those pixels.
 *
 * Per-frame `uCapPlaneIndex` (set by RenderManager between cap
 * draws) picks which active section plane is the cap target:
 *
 *   - Fragments NOT in the cap plane's clipped half-space discard.
 *   - Fragments clipped by ANY OTHER active plane also discard
 *     (the model isn't there at all, so the cap shouldn't show).
 *
 * @internal
 */
export class TrianglesStencilMaskTechnique extends DrawTechnique {

  public readonly vertsPerPrim = 3;

  private _capPlaneIndex: number = 0;
  private _uCapPlaneIndex: WebGLUniformLocation | null = null;

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    this.vsMainBegin();
    this.vsSlicingLogic();
    this.vsMainEnd();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDeclarations();
    this.fsSlicingDeclarations();
    this.fsEmit(
      "uniform int uCapPlaneIndex;",
      "out vec4 outColor;",
      "void main(void) {",
      "  if (vClippable == 0u) discard;",
      "  if (uSectionPlaneCount == 0) discard;",
      // Stencil counts the *original* model's entries/exits
      // past the cap plane along the camera ray. Discarding
      // here based on OTHER active planes would skip valid
      // entries/exits and unbalance the count — caps then leak
      // outside the model footprint when multiple planes are
      // active. The cap quad FS applies the union-clip later,
      // checking the cap-plane intersection's world position.
      "  vec4 capPlane = uSectionPlanes[uCapPlaneIndex];",
      "  if (dot(capPlane.xyz, vWorldPos) + capPlane.w <= 0.0) discard;",
      // Colour/depth masks are off in this pass — outColor is
      // written but discarded by the framebuffer. The stencil op
      // (set externally) fires here.
      "  outColor = vec4(0.0);",
      "}"
    );
  }

  /**
   * Called after the technique's program links. Pulls the
   * `uCapPlaneIndex` location so {@link setCapPlaneIndex} can
   * write it between draws.
   */
  public override init() {
    const result = super.init();
    if (result.ok && this._program) {
      this._uCapPlaneIndex = this._program.getLocation("uCapPlaneIndex");
    }
    return result;
  }

  /**
   * Selects which entry of the FS's `uSectionPlanes[]` array is
   * the active cap target for the next draw. RenderManager calls
   * this once per cap-enabled plane before issuing the
   * front-cull + back-cull stencil writes.
   */
  setCapPlaneIndex(index: number): void {
    if (this._capPlaneIndex === index) return;
    this._capPlaneIndex = index;
    const gl = this._renderContext.gl;
    if (this._uCapPlaneIndex && this._program) {
      this._program.bind();
      gl.uniform1i(this._uCapPlaneIndex, index);
    }
  }
}
