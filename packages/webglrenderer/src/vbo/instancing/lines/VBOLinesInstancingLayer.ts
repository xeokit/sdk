import {VBOInstancingLayer} from "../VBOInstancingLayer";
import {VBOInstancingLayerParams} from "../VBOInstancingLayerParams";
import {rendererFactory} from "./renderers/rendererFactory";

/**
 * @private
 */
export class VBOLinesInstancingLayer extends VBOInstancingLayer {
    constructor(layerParams: VBOInstancingLayerParams) {
        super(layerParams, rendererFactory.getRenderers(layerParams.renderContext.webglRenderer));
    }
}
