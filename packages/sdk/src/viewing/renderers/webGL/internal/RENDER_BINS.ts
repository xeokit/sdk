/**
 * IDs of the render bins used internally the `WebGLRenderer`.
 *
 * @internal
 */
export const RENDER_BINS = {

  /**
   * Meshes rendered as opaque, normal color.
   */
  OPAQUE: "opaque",

  /**
   * Edges of opaque meshes rendered in normal color mode.
   */
  EDGES_OPAQUE: "edgesColorOpaque",

  /**
   * Triangle mesh edges rendered as transparent, normal color.
   */
  EDGES_TRANSPARENT: "edgesColorTransparent",

  /**
   * Meshes rendered as transparent, normal color.
   */
  TRANSPARENT: "normalFillTransparent",

  /**
   * Meshes rendered with an opaque resolved style-bin treatment.
   */
  STYLE_BIN_FILL_OPAQUE: "styleBinFillOpaque",

  /**
   * Edges rendered with an opaque resolved style-bin treatment.
   */
  STYLE_BIN_EDGES_OPAQUE: "styleBinEdgesOpaque",

  /**
   * Meshes rendered with a transparent resolved style-bin treatment.
   */
  STYLE_BIN_FILL_TRANSPARENT: "styleBinFillTransparent",

  /**
   * Edges rendered with a transparent resolved style-bin treatment.
   */
  STYLE_BIN_EDGES_TRANSPARENT: "styleBinEdgesTransparent",

  /**
   * Meshes rendered for picking (renders mesh IDs to pick buffer).
   */
  PICK: "pick"
};
