import { VBOBatchingLayer } from "./VBOBatchingLayer";
import { VBORenderer } from "../VBORenderer";
/**
 * @private
 */
export declare abstract class VBOBatchingRenderer extends VBORenderer {
    renderVBOBatchingLayer(vboBatchingLayer: VBOBatchingLayer, renderPass: number): void;
    abstract drawVBOBatchingLayerPrimitives(vboBatchingLayer: VBOBatchingLayer, renderPass: number): any;
}
//# sourceMappingURL=VBOBatchingRenderer.d.ts.map