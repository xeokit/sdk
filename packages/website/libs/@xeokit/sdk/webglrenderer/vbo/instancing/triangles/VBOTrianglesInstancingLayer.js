import { VBOInstancingLayer } from "../VBOInstancingLayer";
import { rendererFactory } from "./renderers/rendererFactory";
/**
 * @private
 */
export class VBOTrianglesInstancingLayer extends VBOInstancingLayer {
    constructor(VBOInstancingLayerParams) {
        super(VBOInstancingLayerParams, rendererFactory.getRenderers(VBOInstancingLayerParams.renderContext.webglRenderer));
    }
}
//# sourceMappingURL=VBOTrianglesInstancingLayer.js.map