/**
 * Parameters for {@link SceneModel.createTechnique | SceneModel.createTechnique}.
 *
 * A {@link SceneTechnique} declares which non-default *draw path*
 * a {@link model!scene.SceneMesh | SceneMesh} should render through — the rendering
 * *style*, as distinct from a {@link model!scene.SceneMaterial | SceneMaterial}'s shading
 * model. Different technique types unlock different shader
 * families inside the renderer (thick lines, dashed lines,
 * sketch outlines, contour fills, hologram glow…).
 *
 * The base shape carries `id` and a discriminator `type`; each
 * technique type extends with its own knobs. Use the
 * discriminated-union {@link SceneTechniqueParams} type as the
 * parameter form for `createTechnique`.
 */
export interface SceneTechniqueParamsBase {

  /**
   * ID for the new technique. Must be unique within its
   * containing {@link model!scene.SceneModel | SceneModel}'s `techniques` registry.
   */
  id: string;
}


/**
 * How a {@link ThickLinesTechnique} interprets its `lineWidth`:
 *
 *   - `"screen"` — the line is exactly `lineWidth` pixels wide
 *     at every depth. The shader cancels the perspective
 *     divide so distant lines stay the same on-screen
 *     thickness. Default; ideal for technical drawings,
 *     blueprints, UI overlays.
 *   - `"perspective"` — the line is `lineWidth` pixels wide
 *     at the near plane and *diminishes with depth* like any
 *     other geometry. The shader lets the perspective divide
 *     do its normal thing. Ideal for 3D wireframes where the
 *     line should read as a physical edge.
 */
export type ThickLinesWidthMode = "screen" | "perspective";


/**
 * Thick-line draw path. Quad-expands every line in the vertex
 * shader and antialiases the edges in the fragment shader, so
 * lines render at any pixel thickness on every WebGL2 backend
 * — including ones that clamp `gl.LINES` to a single pixel.
 *
 * Applies to `LinesPrimitive` meshes and to the edge index
 * buffer of `TrianglesPrimitive` meshes; ignored on `Points`
 * meshes.
 */
export interface ThickLinesTechniqueParams extends SceneTechniqueParamsBase {

  /**
   * Discriminator for {@link SceneTechniqueParams}.
   */
  type: "thickLines";

  /**
   * Pixel thickness for line meshes carrying this technique.
   * `0` or undefined means "fall back to the View's
   * `linesMaterial.lineWidth`"; any positive value overrides
   * that fallback per-technique.
   */
  lineWidth?: number;

  /**
   * Whether `lineWidth` is interpreted in screen space
   * (constant pixel thickness at every depth) or perspective
   * space (diminishes with distance). Default `"screen"`.
   *
   * See {@link ThickLinesWidthMode}.
   */
  widthMode?: ThickLinesWidthMode;
}


/**
 * Discriminated union of every supported SceneTechnique
 * parameter shape. Extended in lockstep with each new
 * technique subclass under `SceneModel.createTechnique`'s
 * factory switch.
 */
export type SceneTechniqueParams = ThickLinesTechniqueParams;
