/**
 * Indicates what rendering needs to be done for the layers within a {@link WebGLVBOSceneModel}.
 *
 * Each WebGLVBOSceneModel has a RenderFlags in {@link WebGLVBOSceneModel.renderFlags}.
 *
 * Before rendering each frame, {@link WebGLSceneRenderer} will call {@link WebGLVBOSceneModel.rebuildRenderFlags} on each {@link WebGLVBOSceneModel}.
 *
 * Then, when rendering a frame, Renderer will apply rendering passes to each WebGLVBOSceneModel according on what flags are set in {@link WebGLVBOSceneModel.renderFlags}.
 *
 * @private
 */
class RenderFlags {

    /**
     * Set by {@link WebGLVBOSceneModel.rebuildRenderFlags} to indicate which layers are visible within the {@link WebGLVBOSceneModel}.
     *
     * This is a list of IDs of visible layers within the {@link WebGLVBOSceneModel}. The IDs will be whatever the
     * {@link WebGLVBOSceneModel} uses to identify its layers, usually integers.
     */
    visibleLayers: number[];

    /**
     * Set by {@link WebGLVBOSceneModel.rebuildRenderFlags} to indicate which {@link SectionPlane}s are active within each layer of the {@link WebGLVBOSceneModel}.
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
     * Set by {@link WebGLVBOSceneModel.rebuildRenderFlags} to indicate whether the {@link WebGLVBOSceneModel} is culled.
     *
     * When this is ````false````, then all of the other properties on ````RenderFlags```` will remain at their default values.
     */
    culled: boolean;

    /**
     * Set by {@link WebGLVBOSceneModel#rebuildRenderFlags} to indicate whether the {@link WebGLVBOSceneModel} is sliced by any {@link SectionPlane}s.
     */

    sectioned: boolean;

    /**
     * Set by {@link WebGLVBOSceneModel#rebuildRenderFlags} to indicate the number of layers within the {@link WebGLVBOSceneModel}.
     */
    numLayers: number;

    /**
     * Set by {@link WebGLVBOSceneModel#rebuildRenderFlags} to indicate the number of visible layers within the {@link WebGLVBOSceneModel}.
     */
    numVisibleLayers: number;

    /**
     * Set by {@link WebGLVBOSceneModel#rebuildRenderFlags} to indicate the {@link WebGLVBOSceneModel} needs {@link WebGLVBOSceneModel#drawColorOpaque}.
     */
    colorOpaque: boolean;

    /**
     * Set by {@link WebGLVBOSceneModel#rebuildRenderFlags} to indicate the {@link WebGLVBOSceneModel} needs {@link WebGLVBOSceneModel#drawColorTransparent}.
     */
    colorTransparent: boolean;

    /**
     * Set by {@link WebGLVBOSceneModel#rebuildRenderFlags} to indicate the {@link WebGLVBOSceneModel} needs {@link WebGLVBOSceneModel#drawEdgesColorOpaque}.
     */
    edgesOpaque: boolean;

    /**
     * Set by {@link WebGLVBOSceneModel#rebuildRenderFlags} to indicate the {@link WebGLVBOSceneModel} needs {@link WebGLVBOSceneModel#drawEdgesColorTransparent}.
     */
    edgesTransparent: boolean;

    /**
     * Set by {@link WebGLVBOSceneModel#rebuildRenderFlags} to indicate the {@link WebGLVBOSceneModel} needs an opaque {@link WebGLVBOSceneModel#drawSilhouetteXRayed}.
     */
    xrayedSilhouetteOpaque: boolean;

    /**
     * Set by {@link WebGLVBOSceneModel#rebuildRenderFlags} to indicate the {@link WebGLVBOSceneModel} needs an opaque {@link WebGLVBOSceneModel#drawEdgesXRayed}.
     */
    xrayedEdgesOpaque: boolean;

    /**
     * Set by {@link WebGLVBOSceneModel#rebuildRenderFlags} to indicate the {@link WebGLVBOSceneModel} needs a transparent {@link WebGLVBOSceneModel#drawSilhouetteXRayed}.
     */
    xrayedSilhouetteTransparent: boolean;

    /**
     * Set by {@link WebGLVBOSceneModel#rebuildRenderFlags} to indicate the {@link WebGLVBOSceneModel} needs a transparent {@link WebGLVBOSceneModel#drawEdgesXRayed}.
     */
    xrayedEdgesTransparent: boolean;

    /**
     * Set by {@link WebGLVBOSceneModel#rebuildRenderFlags} to indicate the {@link WebGLVBOSceneModel} needs an opaque {@link WebGLVBOSceneModel#drawSilhouetteHighlighted}.
     */
    highlightedSilhouetteOpaque: boolean;

    /**
     * Set by {@link WebGLVBOSceneModel#rebuildRenderFlags} to indicate the {@link WebGLVBOSceneModel} needs an opaque {@link WebGLVBOSceneModel#drawEdgesHighlighted}.
     */
    highlightedEdgesOpaque: boolean;

    /**
     * Set by {@link WebGLVBOSceneModel#rebuildRenderFlags} to indicate the {@link WebGLVBOSceneModel} needs a transparent {@link WebGLVBOSceneModel#drawSilhouetteHighlighted}.
     */
    highlightedSilhouetteTransparent: boolean;

    /**
     * Set by {@link WebGLVBOSceneModel#rebuildRenderFlags} to indicate the {@link WebGLVBOSceneModel} needs a transparent {@link WebGLVBOSceneModel#drawEdgesHighlighted}.
     */
    highlightedEdgesTransparent: boolean;

    /**
     * Set by {@link WebGLVBOSceneModel#rebuildRenderFlags} to indicate the {@link WebGLVBOSceneModel} needs an opaque {@link WebGLVBOSceneModel#drawSilhouetteSelected}.
     */
    selectedSilhouetteOpaque: boolean;

    /**
     * Set by {@link WebGLVBOSceneModel#rebuildRenderFlags} to indicate the {@link WebGLVBOSceneModel} needs an opaque {@link WebGLVBOSceneModel#drawEdgesSelected}.
     */
    selectedEdgesOpaque: boolean;

    /**
     * Set by {@link WebGLVBOSceneModel#rebuildRenderFlags} to indicate the {@link WebGLVBOSceneModel} needs a transparent {@link WebGLVBOSceneModel#drawSilhouetteSelected}.
     */
    selectedSilhouetteTransparent: boolean;

    /**
     * Set by {@link WebGLVBOSceneModel#rebuildRenderFlags} to indicate the {@link WebGLVBOSceneModel} needs a transparent {@link WebGLVBOSceneModel#drawEdgesSelected}.
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