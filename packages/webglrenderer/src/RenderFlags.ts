/**
 * Indicates what rendering needs to be done for the layers within a {@link Drawable}.
 *
 * Each Drawable has a RenderFlags in {@link Drawable#renderFlags}.
 *
 * Before rendering each frame, {@link Renderer} will call {@link Drawable#rebuildRenderFlags} on each {@link Drawable}.
 *
 * Then, when rendering a frame, Renderer will apply rendering passes to each Drawable according on what flags are set in {@link Drawable#renderFlags}.
 *
 * @private
 */
class RenderFlags {

    /**
     * Set by {@link Drawable#rebuildRenderFlags} to indicate which layers are visible within the {@link Drawable}.
     *
     * This is a list of IDs of visible layers within the {@link Drawable}. The IDs will be whatever the
     * {@link Drawable} uses to identify its layers, usually integers.
     *
     * @property visibleLayers
     * @type {Number[]}
     */
    visibleLayers: any[];

    /**
     * Set by {@link Drawable#rebuildRenderFlags} to indicate which {@link SectionPlane}s are active within each layer of the {@link Drawable}.
     *
     * Layout is as follows:
     *
     * ````[
     *      false, false, true, // Layer 0, SectionPlanes 0, 1, 2
     *      false, true, true,  // Layer 1, SectionPlanes 0, 1, 2
     *      true, false, true   // Layer 2, SectionPlanes 0, 1, 2
     * ]````
     *
     * @property sectionPlanesActivePerLayer
     * @type {Boolean[]}
     */
    sectionPlanesActivePerLayer: any[];
    culled: boolean;
    sectioned: boolean;
    numLayers: number;
    numVisibleLayers: number;
    colorOpaque: boolean;
    colorTransparent: boolean;
    edgesOpaque: boolean;
    edgesTransparent: boolean;
    xrayedSilhouetteOpaque: boolean;
    xrayedEdgesOpaque: boolean;
    xrayedSilhouetteTransparent: boolean;
    xrayedEdgesTransparent: boolean;
    highlightedSilhouetteOpaque: boolean;
    highlightedEdgesOpaque: boolean;
    highlightedSilhouetteTransparent: boolean;
    highlightedEdgesTransparent: boolean;
    selectedSilhouetteOpaque: boolean;
    selectedEdgesOpaque: boolean;
    selectedSilhouetteTransparent: boolean;
    selectedEdgesTransparent: boolean;

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

export {RenderFlags};
