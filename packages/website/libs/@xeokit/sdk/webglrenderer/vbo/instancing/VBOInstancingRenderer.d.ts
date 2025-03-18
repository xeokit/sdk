import { VBOInstancingLayer } from "./VBOInstancingLayer";
import { VBORenderer } from "../VBORenderer";
/**
 * @private
 */
export declare abstract class VBOInstancingRenderer extends VBORenderer {
    renderVBOInstancingLayer(vboInstancingLayer: VBOInstancingLayer, renderPass: number): void;
    abstract drawVBOInstancingLayerPrimitives(vboInstancingLayer: VBOInstancingLayer, renderPass: number): any;
}
//# sourceMappingURL=VBOInstancingRenderer.d.ts.map