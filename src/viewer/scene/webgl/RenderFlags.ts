/**
 * Indicates what rendering needs to be done for the layers within a {@link WebGLSceneModel}.
 *
 * Each WebGLSceneModel has a RenderFlags in {@link WebGLSceneModel.renderFlags}.
 *
 * Before rendering each frame, {@link Renderer} will call {@link WebGLSceneModel.rebuildRenderFlags} on each {@link WebGLSceneModel}.
 *
 * Then, when rendering a frame, Renderer will apply rendering passes to each WebGLSceneModel according on what flags are set in {@link WebGLSceneModel.renderFlags}.
 *
 * @private
 */
class RenderFlags {

    /**
     * Set by {@link WebGLSceneModel.rebuildRenderFlags} to indicate which layers are visible within the {@link WebGLSceneModel}.
     *
     * This is a list of IDs of visible layers within the {@link WebGLSceneModel}. The IDs will be whatever the
     * {@link WebGLSceneModel} uses to identify its layers, usually integers.
     */
    visibleLayers: number[];

    /**
     * Set by {@link WebGLSceneModel.rebuildRenderFlags} to indicate which {@link SectionPlane}s are active within each layer of the {@link WebGLSceneModel}.
     *
     * Layout is as follows:
     *
     * ````[
     *      false, false, true, // Layer 0, SectionPlanes 0, 1, 2
     *      false, true, true,  // Layer 1, SectionPlanes 0, 1, 2
     *      true, false, true   // Layer 2, SectionPlanes 0, 1, 2
     * ]````
     */
    sectionPlanesActivePerLayer: boolean[];

    /**
     * Set by {@link WebGLSceneModel.rebuildRenderFlags} to indicate whether the {@link WebGLSceneModel} is culled.
     *
     * When this is ````false````, then all of the other properties on ````RenderFlags```` will remain at their default values.
     */
    culled: boolean;

    /**
     * Set by {@link WebGLSceneModel#rebuildRenderFlags} to indicate whether the {@link WebGLSceneModel} is sliced by any {@link SectionPlane}s.
     */

    sectioned: boolean;

    /**
     * Set by {@link WebGLSceneModel#rebuildRenderFlags} to indicate the number of layers within the {@link WebGLSceneModel}.
     */
    numLayers: number;

    /**
     * Set by {@link WebGLSceneModel#rebuildRenderFlags} to indicate the number of visible layers within the {@link WebGLSceneModel}.
     */
    numVisibleLayers: number;

    /**
     * Set by {@link WebGLSceneModel#rebuildRenderFlags} to indicate the {@link WebGLSceneModel} needs {@link WebGLSceneModel#drawColorOpaque}.
     */
    colorOpaque: boolean;

    /**
     * Set by {@link WebGLSceneModel#rebuildRenderFlags} to indicate the {@link WebGLSceneModel} needs {@link WebGLSceneModel#drawColorTransparent}.
     */
    colorTransparent: boolean;

    /**
     * Set by {@link WebGLSceneModel#rebuildRenderFlags} to indicate the {@link WebGLSceneModel} needs {@link WebGLSceneModel#drawEdgesColorOpaque}.
     */
    edgesOpaque: boolean;

    /**
     * Set by {@link WebGLSceneModel#rebuildRenderFlags} to indicate the {@link WebGLSceneModel} needs {@link WebGLSceneModel#drawEdgesColorTransparent}.
     */
    edgesTransparent: boolean;

    /**
     * Set by {@link WebGLSceneModel#rebuildRenderFlags} to indicate the {@link WebGLSceneModel} needs an opaque {@link WebGLSceneModel#drawSilhouetteXRayed}.
     */
    xrayedSilhouetteOpaque: boolean;

    /**
     * Set by {@link WebGLSceneModel#rebuildRenderFlags} to indicate the {@link WebGLSceneModel} needs an opaque {@link WebGLSceneModel#drawEdgesXRayed}.
     */
    xrayedEdgesOpaque: boolean;

    /**
     * Set by {@link WebGLSceneModel#rebuildRenderFlags} to indicate the {@link WebGLSceneModel} needs a transparent {@link WebGLSceneModel#drawSilhouetteXRayed}.
     */
    xrayedSilhouetteTransparent: boolean;

    /**
     * Set by {@link WebGLSceneModel#rebuildRenderFlags} to indicate the {@link WebGLSceneModel} needs a transparent {@link WebGLSceneModel#drawEdgesXRayed}.
     */
    xrayedEdgesTransparent: boolean;

    /**
     * Set by {@link WebGLSceneModel#rebuildRenderFlags} to indicate the {@link WebGLSceneModel} needs an opaque {@link WebGLSceneModel#drawSilhouetteHighlighted}.
     */
    highlightedSilhouetteOpaque: boolean;

    /**
     * Set by {@link WebGLSceneModel#rebuildRenderFlags} to indicate the {@link WebGLSceneModel} needs an opaque {@link WebGLSceneModel#drawEdgesHighlighted}.
     */
    highlightedEdgesOpaque: boolean;

    /**
     * Set by {@link WebGLSceneModel#rebuildRenderFlags} to indicate the {@link WebGLSceneModel} needs a transparent {@link WebGLSceneModel#drawSilhouetteHighlighted}.
     */
    highlightedSilhouetteTransparent: boolean;

    /**
     * Set by {@link WebGLSceneModel#rebuildRenderFlags} to indicate the {@link WebGLSceneModel} needs a transparent {@link WebGLSceneModel#drawEdgesHighlighted}.
     */
    highlightedEdgesTransparent: boolean;

    /**
     * Set by {@link WebGLSceneModel#rebuildRenderFlags} to indicate the {@link WebGLSceneModel} needs an opaque {@link WebGLSceneModel#drawSilhouetteSelected}.
     */
    selectedSilhouetteOpaque: boolean;

    /**
     * Set by {@link WebGLSceneModel#rebuildRenderFlags} to indicate the {@link WebGLSceneModel} needs an opaque {@link WebGLSceneModel#drawEdgesSelected}.
     */
    selectedEdgesOpaque: boolean;

    /**
     * Set by {@link WebGLSceneModel#rebuildRenderFlags} to indicate the {@link WebGLSceneModel} needs a transparent {@link WebGLSceneModel#drawSilhouetteSelected}.
     */
    selectedSilhouetteTransparent: boolean;

    /**
     * Set by {@link WebGLSceneModel#rebuildRenderFlags} to indicate the {@link WebGLSceneModel} needs a transparent {@link WebGLSceneModel#drawEdgesSelected}.
     */
    selectedEdgesTransparent: boolean;

    /**
     * @private
     */
    constructor() {
        this.visibleLayers = [];
        this.sectionPlanesActivePerLayer = [];
        this.reset();
    }

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