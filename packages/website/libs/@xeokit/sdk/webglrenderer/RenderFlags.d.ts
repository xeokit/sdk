/**
 * Indicates what rendering needs to be done for the renderGraph within a {@link Drawable}.
 *
 * Each Drawable has a RenderFlags in {@link Drawable#renderFlags}.
 *
 * Before rendering each frame, {@link Renderer} will call {@link Drawable#rebuildRenderFlags} on each {@link Drawable}.
 *
 * Then, when rendering a frame, Renderer will apply rendering passes to each Drawable according on what flags are set in {@link Drawable#renderFlags}.
 *
 * @private
 */
declare class RenderFlags {
    /**
     * Set by {@link Drawable#rebuildRenderFlags} to indicate which renderGraph are visible within the {@link Drawable}.
     *
     * This is a list of IDs of visible renderGraph within the {@link Drawable}. The IDs will be whatever the
     * {@link Drawable} uses to identify its renderGraph, usually integers.
     *
     * @property visibleLayers
     * @type {Number[]}
     */
    visibleLayers: any[];
    /**
     * Set by {@link Drawable#rebuildRenderFlags} to indicate which {@link SectionPlane}s are active within each _layer of the {@link Drawable}.
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
    constructor();
    /**
     * @private
     */
    reset(): void;
}
export { RenderFlags };
//# sourceMappingURL=RenderFlags.d.ts.map
