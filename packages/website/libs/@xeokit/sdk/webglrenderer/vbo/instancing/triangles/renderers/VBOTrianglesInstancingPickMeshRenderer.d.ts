import { VBOInstancingLayer } from "../../VBOInstancingLayer";
import { VBOInstancingRenderer } from "../../VBOInstancingRenderer";
/**
 * @private
 */
export declare class VBOTrianglesInstancingPickMeshRenderer extends VBOInstancingRenderer {
    getHash(): string;
    buildVertexShader(src: string[]): void;
    buildFragmentShader(src: string[]): void;
    drawVBOInstancingLayerPrimitives(vboInstancingLayer: VBOInstancingLayer, renderPass: number): void;
}
//# sourceMappingURL=VBOTrianglesInstancingPickMeshRenderer.d.ts.map