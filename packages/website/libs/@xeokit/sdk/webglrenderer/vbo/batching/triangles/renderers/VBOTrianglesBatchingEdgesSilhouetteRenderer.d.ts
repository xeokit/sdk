import { VBOBatchingLayer } from "../../VBOBatchingLayer";
import { VBOBatchingRenderer } from "../../VBOBatchingRenderer";
import { RenderContext } from "../../../../RenderContext";
/**
 * @private
 */
export declare class VBOTrianglesBatchingEdgesSilhouetteRenderer extends VBOBatchingRenderer {
    constructor(renderContext: RenderContext);
    getHash(): string;
    buildVertexShader(src: string[]): void;
    buildFragmentShader(src: string[]): void;
    drawVBOBatchingLayerPrimitives(vboBatchingLayer: VBOBatchingLayer, renderPass: number): void;
}
//# sourceMappingURL=VBOTrianglesBatchingEdgesSilhouetteRenderer.d.ts.map