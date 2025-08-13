/**
 * Indicates what rendering needs to be done for a Layer.
 *
 * Each Layer has a RenderFlags in {@link Layer#renderFlags}.
 *
 * Before rendering each frame, {@link Renderer} will call {@link Layer#rebuildRenderFlags} on each {@link Layer}.
 *
 * Then, when rendering a frame, Renderer will apply rendering passes to each Layer acording on what flags
 * are set in {@link Layer#renderFlags}.
 *
 * @private
 */
class RenderFlags {

  /**
   * Indicates whether the layer is culled (not visible).
   */
  culled: boolean;

  /**
   * Indicates whether the layer is sectioned by active `SectionPlane`s.
   */
  sectioned: boolean;

  /**
   * Total number of layers in the `Layer`.
   */
  numLayers: number;

  /**
   * Number of visible layers in the `Layer`.
   */
  numVisibleLayers: number;

  /**
   * Indicates if the opaque color pass is required.
   */
  colorOpaque: boolean;

  /**
   * Indicates if the transparent color pass is required.
   */
  colorTransparent: boolean;

  /**
   * Indicates if the opaque edges pass is required.
   */
  edgesOpaque: boolean;

  /**
   * Indicates if the transparent edges pass is required.
   */
  edgesTransparent: boolean;

  /**
   * Indicates if the opaque x-rayed silhouette pass is required.
   */
  xrayedSilhouetteOpaque: boolean;

  /**
   * Indicates if the opaque x-rayed edges pass is required.
   */
  xrayedEdgesOpaque: boolean;

  /**
   * Indicates if the transparent x-rayed silhouette pass is required.
   */
  xrayedSilhouetteTransparent: boolean;

  /**
   * Indicates if the transparent x-rayed edges pass is required.
   */
  xrayedEdgesTransparent: boolean;

  /**
   * Indicates if the opaque highlighted silhouette pass is required.
   */
  highlightedSilhouetteOpaque: boolean;

  /**
   * Indicates if the opaque highlighted edges pass is required.
   */
  highlightedEdgesOpaque: boolean;

  /**
   * Indicates if the transparent highlighted silhouette pass is required.
   */
  highlightedSilhouetteTransparent: boolean;

  /**
   * Indicates if the transparent highlighted edges pass is required.
   */
  highlightedEdgesTransparent: boolean;

  /**
   * Indicates if the opaque selected silhouette pass is required.
   */
  selectedSilhouetteOpaque: boolean;

  /**
   * Indicates if the opaque selected edges pass is required.
   */
  selectedEdgesOpaque: boolean;

  /**
   * Indicates if the transparent selected silhouette pass is required.
   */
  selectedSilhouetteTransparent: boolean;

  /**
   * Indicates if the transparent selected edges pass is required.
   */
  selectedEdgesTransparent: boolean;

  /**
   * Creates a new instance of RenderFlags with all flags reset to their initial state.
   */
  constructor() {
    this.reset();
  }

  /**
   * Resets the render flags to their initial state.
   */
  reset() {
    this.culled = false;
    this.sectioned = false;
    this.numLayers = 0;
    this.numVisibleLayers = 0;
    this.colorOpaque = false;
    this.colorTransparent = false;
    this.edgesOpaque = false;
    this.edgesTransparent = false;
    this.xrayedSilhouetteOpaque = false;
    this.xrayedEdgesOpaque = false;
    this.xrayedSilhouetteTransparent = false;
    this.xrayedEdgesTransparent = false;
    this.highlightedSilhouetteOpaque = false;
    this.highlightedEdgesOpaque = false;
    this.highlightedSilhouetteTransparent = false;
    this.highlightedEdgesTransparent = false;
    this.selectedSilhouetteOpaque = false;
    this.selectedEdgesOpaque = false;
    this.selectedSilhouetteTransparent = false;
    this.selectedEdgesTransparent = false;
  }
}

export {RenderFlags};
