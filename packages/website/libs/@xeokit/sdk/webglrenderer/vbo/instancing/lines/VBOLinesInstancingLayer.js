import { VBOInstancingLayer } from "../VBOInstancingLayer";
import { rendererFactory } from "./renderers/rendererFactory";
/**
 * @private
 */
export class VBOLinesInstancingLayer extends VBOInstancingLayer {
    constructor(layerParams) {
        super(layerParams, rendererFactory.getRenderers(layerParams.renderContext.webglRenderer));
    }
}
//# sourceMappingURL=VBOLinesInstancingLayer.js.map