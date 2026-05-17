import {DrawTechnique} from "../../DrawTechnique";
import type {GPUMemoryReader} from "../../../gpuMemoryManager/GPUMemoryReader";
import type {RenderContext} from "../../../RenderContext";


/**
 * Draw technique for rendering lines with a flat (per-mesh) color
 * at user-controlled pixel thickness — works on every WebGL2
 * implementation, including ones that clamp `gl.LINES` to a
 * single pixel (notably ANGLE on Windows).
 *
 * Each line is expanded into two triangles in the vertex shader:
 * six vertices, the screen-space perpendicular derived from the
 * two endpoints, half-width applied as a pixel-space offset
 * that the fragment shader smoothsteps for antialiasing.
 *
 * No extra vertex data needed — the existing edge-indexed line
 * buffer is reused; `gl_VertexID` drives endpoint, side, and
 * triangle selection. The base class's `_draw` switches to
 * `gl.drawArrays(gl.TRIANGLES, …, n * 6)` when `thickLines` is
 * `true`.
 *
 * Line thickness is read from
 * `View.linesMaterial.lineWidth` and uploaded each frame as
 * `uLineWidth`. Default of `1` produces lines visually close to
 * the legacy hardware-line path (single-pixel core + 1-pixel
 * smoothstep AA).
 *
 * @internal
 */
export class ThickLinesDrawColorTechnique extends DrawTechnique {

  public readonly vertsPerPrim = 6;

  constructor(renderContext: RenderContext, gpuMemoryReader: GPUMemoryReader) {
    super(renderContext, gpuMemoryReader, {thickLines: true});
  }

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    this.vsDrawFlatColorDeclarations();
    this.vsThickLineDeclarations();
    this.vsThickLineMain();
    this.vsDrawFlatColorLogic();
    this.vsSlicingLogic();
    this.vsMainEnd();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDeclarations();
    this.fsColorDeclarations();
    this.fsSlicingDeclarations();
    this.fsDrawFlatColorDeclarations();
    this.fsThickLineDeclarations();
    this.fsMainBegin();
    this.fsSlicingLogic();
    this.fsDrawFlatColorLogic();
    this.fsThickLineLogic();
    this.fsOutputColor();
    this.fsMainEnd();
  }
}
