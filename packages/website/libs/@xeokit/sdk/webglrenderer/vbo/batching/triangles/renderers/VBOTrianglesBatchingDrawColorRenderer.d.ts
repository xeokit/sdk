import { VBOBatchingLayer } from "../../VBOBatchingLayer";
import { VBOBatchingRenderer } from "../../VBOBatchingRenderer";
/**
 * @private
 */
export declare class VBOTrianglesBatchingDrawColorRenderer extends VBOBatchingRenderer {
    getHash(): string;
    buildVertexShader(src: string[]): void;
    buildFragmentShader(src: string[]): void;
    drawVBOBatchingLayerPrimitives(vboBatchingLayer: VBOBatchingLayer, renderPass: number): void;
}
//# sourceMappingURL=VBOTrianglesBatchingDrawColorRenderer.d.ts.map