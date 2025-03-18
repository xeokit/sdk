import { VBOBatchingLayer } from "../../VBOBatchingLayer";
import { VBOBatchingRenderer } from "../../VBOBatchingRenderer";
/**
 * @private
 */
export declare class VBOTrianglesBatchingDrawColorSAORenderer extends VBOBatchingRenderer {
    getHash(): string;
    buildVertexShader(src: string[]): void;
    buildFragmentShader(src: string[]): void;
    drawVBOBatchingLayerPrimitives(vboBatchingLayer: VBOBatchingLayer, renderPass: number): void;
}
//# sourceMappingURL=VBOTrianglesBatchingDrawColorSAORenderer.d.ts.map