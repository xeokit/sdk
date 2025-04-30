import { rendererFactory } from "./renderers/rendererFactory";
import { VBOInstancingLayer } from "../VBOInstancingLayer";
import { VBOInstancingLayerParams } from "../VBOInstancingLayerParams";

/**
 * @private
 */
export class VBOTrianglesInstancingLayer extends VBOInstancingLayer {
  constructor(VBOInstancingLayerParams: VBOInstancingLayerParams) {
    super(VBOInstancingLayerParams, rendererFactory.getRenderers(VBOInstancingLayerParams.renderContext.webglRenderer));
  }
}
