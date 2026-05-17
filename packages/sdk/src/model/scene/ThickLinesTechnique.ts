import {SceneTechnique, type SceneTechniqueMode} from "./SceneTechnique";
import type {SceneModel} from "./SceneModel";
import type {
  ThickLinesTechniqueParams,
  ThickLinesWidthMode,
} from "./SceneTechniqueParams";


/**
 * Thick-line draw path — quad-expands every line in the vertex
 * shader to user-controlled pixel thickness, with smoothstep
 * antialiasing across the line's cross-axis. Renders at any
 * thickness on every WebGL2 backend, including ANGLE on Windows
 * which clamps `gl.LINES` to a single pixel.
 *
 * Substitutive: a mesh with this technique attached renders
 * through the thick-line shader instead of the default
 * hardware-line path.
 *
 * @see {@link SceneTechnique}
 */
export class ThickLinesTechnique extends SceneTechnique {

  readonly type = "thickLines" as const;
  readonly mode: SceneTechniqueMode = "substitutive";

  /**
   * Pixel thickness for line meshes carrying this technique.
   * `0` means "fall back to the View's
   * `linesMaterial.lineWidth`"; any positive value overrides
   * that fallback per-technique. The thick-line draw technique
   * reads this value into the per-mesh attribute table at GPU
   * upload, then consumes it in the vertex shader's
   * quad-expansion step.
   */
  lineWidth: number;

  /**
   * Whether {@link lineWidth} is interpreted in screen space
   * (constant pixel thickness regardless of depth) or
   * perspective space (the line thickness diminishes with
   * distance like any other geometry). Default `"screen"`.
   *
   * Mechanically, `"screen"` makes the vertex shader cancel
   * the perspective divide for the quad-expansion offset, so
   * a 3-pixel line stays 3 pixels wide at the far plane.
   * `"perspective"` lets the perspective divide do its normal
   * thing — `lineWidth` then reads as "pixels at the near
   * plane" and falls off with depth.
   */
  widthMode: ThickLinesWidthMode;

  /**
   * @private
   */
  constructor(model: SceneModel, params: ThickLinesTechniqueParams) {
    super(model, params);
    // Clamp negative input to the "use fallback" sentinel so a
    // stray negative value can't reach the shader as a
    // perpendicular-direction sign flip.
    const w = params.lineWidth;
    this.lineWidth = (w !== undefined && w !== null && w > 0) ? w : 0;
    this.widthMode = params.widthMode === "perspective" ? "perspective" : "screen";
  }
}
