/**
 * @private
 */
export class RenderFlags {
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
     sectionPlanesActivePerLayer: any[];
     visibleLayers: any[];

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
