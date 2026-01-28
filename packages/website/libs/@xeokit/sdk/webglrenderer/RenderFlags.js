/**
 * Indicates what rendering needs to be done for the renderGraph within a {@link Layer}.
 *
 * Each Drawable has a RenderFlags in {@link Layer#renderFlags}.
 *
 * Before rendering each frame, {@link Renderer} will call {@link Layer#rebuildRenderFlags} on each {@link Layer}.
 *
 * Then, when rendering a frame, Renderer will apply rendering passes to each Drawable according on what flags are set in {@link Layer#renderFlags}.
 *
 * @private
 */
class RenderFlags {
    /**
     * Set by {@link Layer#rebuildRenderFlags} to indicate which renderGraph are visible within the {@link Layer}.
     *
     * This is a list of IDs of visible renderGraph within the {@link Layer}. The IDs will be whatever the
     * {@link Layer} uses to identify its renderGraph, usually integers.
     *
     * @property visibleLayers
     * @type {Number[]}
     */
    visibleLayers;
    /**
     * Set by {@link Layer#rebuildRenderFlags} to indicate which {@link SectionPlane}s are active within each _layer of the {@link Layer}.
     *
     * Layout is as follows:
     *
     * ````[
     *      false, false, true, // RenderLayerImpl 0, SectionPlanes 0, 1, 2
     *      false, true, true,  // RenderLayerImpl 1, SectionPlanes 0, 1, 2
     *      true, false, true   // RenderLayerImpl 2, SectionPlanes 0, 1, 2
     * ]````
     *
     * @property sectionPlanesActivePerLayer
     * @type {Boolean[]}
     */
    sectionPlanesActivePerLayer;
    culled;
    sectioned;
    numLayers;
    numVisibleLayers;
    colorOpaque;
    colorTransparent;
    edgesOpaque;
    edgesTransparent;
    xrayedSilhouetteOpaque;
    xrayedEdgesOpaque;
    xrayedSilhouetteTransparent;
    xrayedEdgesTransparent;
    highlightedSilhouetteOpaque;
    highlightedEdgesOpaque;
    highlightedSilhouetteTransparent;
    highlightedEdgesTransparent;
    selectedSilhouetteOpaque;
    selectedEdgesOpaque;
    selectedSilhouetteTransparent;
    selectedEdgesTransparent;
    /**
     * @private
     */
    constructor() {
        this.visibleLayers = [];
        this.sectionPlanesActivePerLayer = [];
        this.reset();
    }
    /**
     * @private
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
export { RenderFlags };
//# sourceMappingURL=RenderFlags.js.map
