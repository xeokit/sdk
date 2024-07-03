import {VBOBatchingLayer} from "../VBOBatchingLayer";
import {VBOBatchingLayerParams} from "../VBOBatchingLayerParams";
import {rendererFactory} from "./renderers/rendererFactory";

/**
 * @private
 */
export class VBOTrianglesBatchingLayer extends VBOBatchingLayer {
    constructor(layerParams: VBOBatchingLayerParams) {
        super(layerParams, rendererFactory.getRenderers(layerParams.renderContext.webglRenderer));
    }
}
