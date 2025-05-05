import { rendererFactory } from "./renderers/rendererFactory";
import { VBOBatchingLayer } from "../VBOBatchingLayer";
import type { VBOBatchingLayerParams } from "../VBOBatchingLayerParams";

/**
 * @private
 */
export class VBOLinesBatchingLayer extends VBOBatchingLayer {
  constructor(layerParams: VBOBatchingLayerParams) {
    super(layerParams, rendererFactory.getRenderers(layerParams.renderContext.webglRenderer));
  }
}
