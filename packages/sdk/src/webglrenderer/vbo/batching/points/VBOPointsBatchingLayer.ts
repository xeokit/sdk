import { rendererFactory } from "./renderers/rendererFactory";
import { VBOBatchingLayer } from "../VBOBatchingLayer";
import { VBOBatchingLayerParams } from "../VBOBatchingLayerParams";

/**
 * @private
 */
export class VBOPointsBatchingLayer extends VBOBatchingLayer {
  constructor(layerParams: VBOBatchingLayerParams) {
    super(layerParams, rendererFactory.getRenderers(layerParams.renderContext.webglRenderer));
  }
}
