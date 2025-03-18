import { VBOBatchingLayer } from "../../VBOBatchingLayer";
import { VBOBatchingRenderer } from "../../VBOBatchingRenderer";
/**
 * @private
 */
export declare class VBOTrianglesBatchingDrawDepthRenderer extends VBOBatchingRenderer {
    getHash(): string;
    buildVertexShader(src: string[]): void;
    buildFragmentShader(src: string[]): void;
    drawVBOBatchingLayerPrimitives(vboBatchingLayer: VBOBatchingLayer, renderPass: number): void;
}
//# sourceMappingURL=VBOTrianglesBatchingDrawDepthRenderer.d.ts.map