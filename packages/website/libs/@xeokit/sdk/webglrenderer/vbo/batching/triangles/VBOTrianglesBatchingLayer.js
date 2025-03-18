import { VBOBatchingLayer } from "../VBOBatchingLayer";
import { rendererFactory } from "./renderers/rendererFactory";
/**
 * @private
 */
export class VBOTrianglesBatchingLayer extends VBOBatchingLayer {
    constructor(layerParams) {
        super(layerParams, rendererFactory.getRenderers(layerParams.renderContext.webglRenderer));
    }
}
//# sourceMappingURL=VBOTrianglesBatchingLayer.js.map