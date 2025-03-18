import { VBOInstancingLayer } from "../../VBOInstancingLayer";
import { VBOInstancingRenderer } from "../../VBOInstancingRenderer";
/**
 * @private
 */
export declare class VBOLinesInstancingDrawColorRenderer extends VBOInstancingRenderer {
    getHash(): string;
    buildVertexShader(src: string[]): void;
    buildFragmentShader(src: string[]): void;
    drawVBOInstancingLayerPrimitives(vboInstancingLayer: VBOInstancingLayer, renderPass: number): void;
}
//# sourceMappingURL=VBOLinesInstancingDrawColorRenderer.d.ts.map