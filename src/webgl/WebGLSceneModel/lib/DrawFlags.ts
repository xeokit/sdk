/**
 * Indicates what rendering needs to be done for the layers within a {@link WebGLSceneModel}.
 *
 * Each WebGLSceneModel has a DrawFlags in {@link WebGLSceneModel.drawFlags}.
 *
 * Before rendering each frame, {@link WebGL2SceneRenderer} will call {@link WebGLSceneModel.rebuildDrawFlags} on each {@link WebGLSceneModel}.
 *
 * Then, when rendering a frame, SceneRenderer will apply rendering passes to each WebGLSceneModel according on what flags are set in {@link WebGLSceneModel.drawFlags}.
 *
 * @private
 */
class DrawFlags {

    /**
     * Set by {@link WebGLSceneModel.rebuildDrawFlags} to indicate which layers are visible within the {@link WebGLSceneModel}.
     *
     * This is a list of IDs of visible layers within the {@link WebGLSceneModel}. The IDs will be whatever the
     * {@link WebGLSceneModel} uses to identify its layers, usually integers.
     */
    visibleLayers: number[];

    /**
     * Set by {@link WebGLSceneModel.rebuildDrawFlags} to indicate which {@link SectionPlane}s are active within each layer of the {@link WebGLSceneModel}.
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
     * Set by {@link WebGLSceneModel.rebuildDrawFlags} to indicate whether the {@link WebGLSceneModel} is culled.
     *
     * When this is ````false````, then all of the other properties on ````DrawFlags```` will remain at their default values.
     */
    culled: boolean;

    /**
     * Set by {@link Drawable#rebuildDrawFlags} to indicate whether the {@link WebGLSceneModel} is sliced by any {@link SectionPlane}s.
     */

    sectioned: boolean;

    /**
     * Set by {@link Drawable#rebuildDrawFlags} to indicate the number of layers within the {@link WebGLSceneModel}.
     */
    numLayers: number;

    /**
     * Set by {@link Drawable#rebuildDrawFlags} to indicate the number of visible layers within the {@link WebGLSceneModel}.
     */
    numVisibleLayers: number;

    /**
     * Set by {@link Drawable#rebuildDrawFlags} to indicate the {@link Drawable} needs {@link Drawable#drawColorOpaque}.
     */
    colorOpaque: boolean;

    /**
     * Set by {@link Drawable#rebuildDrawFlags} to indicate the {@link Drawable} needs {@link Drawable#drawColorTransparent}.
     */
    colorTransparent: boolean;

    /**
     * Set by {@link Drawable#rebuildDrawFlags} to indicate the {@link Drawable} needs {@link Drawable#drawEdgesColorOpaque}.
     */
    edgesOpaque: boolean;

    /**
     * Set by {@link Drawable#rebuildDrawFlags} to indicate the {@link Drawable} needs {@link Drawable#drawEdgesColorTransparent}.
     */
    edgesTransparent: boolean;

    /**
     * Set by {@link Drawable#rebuildDrawFlags} to indicate the {@link Drawable} needs an opaque {@link Drawable#drawSilhouetteXRayed}.
     */
    xrayedSilhouetteOpaque: boolean;

    /**
     * Set by {@link Drawable#rebuildDrawFlags} to indicate the {@link Drawable} needs an opaque {@link Drawable#drawEdgesXRayed}.
     */
    xrayedEdgesOpaque: boolean;

    /**
     * Set by {@link Drawable#rebuildDrawFlags} to indicate the {@link Drawable} needs a transparent {@link Drawable#drawSilhouetteXRayed}.
     */
    xrayedSilhouetteTransparent: boolean;

    /**
     * Set by {@link Drawable#rebuildDrawFlags} to indicate the {@link Drawable} needs a transparent {@link Drawable#drawEdgesXRayed}.
     */
    xrayedEdgesTransparent: boolean;

    /**
     * Set by {@link Drawable#rebuildDrawFlags} to indicate the {@link Drawable} needs an opaque {@link Drawable#drawSilhouetteHighlighted}.
     */
    highlightedSilhouetteOpaque: boolean;

    /**
     * Set by {@link Drawable#rebuildDrawFlags} to indicate the {@link Drawable} needs an opaque {@link Drawable#drawEdgesHighlighted}.
     */
    highlightedEdgesOpaque: boolean;

    /**
     * Set by {@link Drawable#rebuildDrawFlags} to indicate the {@link Drawable} needs a transparent {@link Drawable#drawSilhouetteHighlighted}.
     */
    highlightedSilhouetteTransparent: boolean;

    /**
     * Set by {@link Drawable#rebuildDrawFlags} to indicate the {@link Drawable} needs a transparent {@link Drawable#drawEdgesHighlighted}.
     */
    highlightedEdgesTransparent: boolean;

    /**
     * Set by {@link Drawable#rebuildDrawFlags} to indicate the {@link Drawable} needs an opaque {@link Drawable#drawSilhouetteSelected}.
     */
    selectedSilhouetteOpaque: boolean;

    /**
     * Set by {@link Drawable#rebuildDrawFlags} to indicate the {@link Drawable} needs an opaque {@link Drawable#drawEdgesSelected}.
     */
    selectedEdgesOpaque: boolean;

    /**
     * Set by {@link Drawable#rebuildDrawFlags} to indicate the {@link Drawable} needs a transparent {@link Drawable#drawSilhouetteSelected}.
     */
    selectedSilhouetteTransparent: boolean;

    /**
     * Set by {@link Drawable#rebuildDrawFlags} to indicate the {@link Drawable} needs a transparent {@link Drawable#drawEdgesSelected}.
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

export {DrawFlags};