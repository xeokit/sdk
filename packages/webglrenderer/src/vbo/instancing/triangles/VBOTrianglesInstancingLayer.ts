import {VBOInstancingLayer} from "../VBOInstancingLayer";
import {VBOInstancingLayerParams} from "../VBOInstancingLayerParams";
import {rendererFactory} from "./renderers/rendererFactory";

/**
 * @private
 */
export class VBOTrianglesInstancingLayer extends VBOInstancingLayer {
    constructor(VBOInstancingLayerParams: VBOInstancingLayerParams) {
        super(VBOInstancingLayerParams, rendererFactory.getRenderers(VBOInstancingLayerParams.renderContext.webglRenderer));
    }
}
