import {VBOBatchingLayer} from "../VBOBatchingLayer";
import {LayerParams} from "../../../LayerParams";
import {rendererFactory} from "./renderers/rendererFactory";

/**
 * @private
 */
export class VBOPointsBatchingLayer extends VBOBatchingLayer {
    constructor(layerParams: LayerParams) {
        super(layerParams, rendererFactory.getRenderers(layerParams.renderContext.webglRenderer));
    }
}
