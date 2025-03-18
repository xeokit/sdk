import { VBOInstancingLayer } from "../../VBOInstancingLayer";
import { VBOInstancingRenderer } from "../../VBOInstancingRenderer";
/**
 * @private
 */
export declare class VBOTrianglesInstancingSilhouetteRenderer extends VBOInstancingRenderer {
    getHash(): string;
    buildVertexShader(src: string[]): void;
    buildFragmentShader(src: string[]): void;
    drawVBOInstancingLayerPrimitives(vboInstancingLayer: VBOInstancingLayer, renderPass: number): void;
}
//# sourceMappingURL=VBOTrianglesInstancingSilhouetteRenderer.d.ts.map