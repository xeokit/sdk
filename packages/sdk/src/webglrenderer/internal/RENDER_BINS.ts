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
   * Meshes rendered in X-rayed state as transparent, monochrome silhouettes.
   */
  XRAYED_SILHOUETTE_OPAQUE: "xrayedSilhouetteOpaque",

  /**
   * Meshes rendered in X-rayed state as opaque, monochrome silhouettes (unusual).
   */
  XRAYED_EDGES_OPAQUE: "xrayedEdgesOpaque",

  /**
   * Triangle mesh edges in X-rayed state rendered as transparent.
   */
  XRAYED_EDGES_TRANSPARENT: "xrayedEdgesTransparent",

  /**
   * Meshes in X-rayed state rendered as transparent, monochrome silhouettes.
   */
  XRAYED_SILHOUETTE_TRANSPARENT: "xrayedSilhouetteTransparent",

  /**
   * Triangle mesh edges rendered as transparent, normal color.
   */
  EDGES_TRANSPARENT: "edgesColorTransparent",

  /**
   * Meshes rendered as transparent, normal color.
   */
  TRANSPARENT: "normalFillTransparent",

  /**
   * Meshes rendered in highlighted state as opaque, monochrome silhouettes.
   */
  HIGHLIGHTED_SILHOUETTE_OPAQUE: "highlightedSilhouetteOpaque",

  /**
   * Meshes rendered in selected state as opaque, monochrome silhouettes.
   */
  SELECTED_SILHOUETTE_OPAQUE: "selectedSilhouetteOpaque",

  /**
   * Meshes rendered in highlighted state as transparent, monochrome silhouettes.
   */
  HIGHLIGHTED_SILHOUETTE_TRANSPARENT: "highlightedSilhouetteTransparent",

  /**
   * Meshes rendered in selected state as transparent, monochrome silhouettes.
   */
  SELECTED_SILHOUETTE_TRANSPARENT: "selectedSilhouetteTransparent",

  /**
   * Meshes rendered for picking (renders mesh IDs to pick buffer).
   */
  PICK: "pick"
};

