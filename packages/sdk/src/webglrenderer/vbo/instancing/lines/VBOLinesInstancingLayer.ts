import { rendererFactory } from "./renderers/rendererFactory";
import { VBOInstancingLayer } from "../VBOInstancingLayer";
import type { VBOInstancingLayerParams } from "../VBOInstancingLayerParams";

/**
 * @private
 */
export class VBOLinesInstancingLayer extends VBOInstancingLayer {
  constructor(layerParams: VBOInstancingLayerParams) {
    super(layerParams, rendererFactory.getRenderers(layerParams.renderContext.webglRenderer));
  }
}
