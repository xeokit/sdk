import { VBOInstancingLayer } from "../../VBOInstancingLayer";
import { VBOInstancingRenderer } from "../../VBOInstancingRenderer";
import { RenderContext } from "../../../../RenderContext";
/**
 * @private
 */
export declare class VBOTrianglesInstancingEdgesSilhouetteRenderer extends VBOInstancingRenderer {
    constructor(renderContext: RenderContext);
    getHash(): string;
    buildVertexShader(src: string[]): void;
    buildFragmentShader(src: string[]): void;
    drawVBOInstancingLayerPrimitives(vboInstancingLayer: VBOInstancingLayer, renderPass: number): void;
}
//# sourceMappingURL=VBOTrianglesInstancingEdgesSilhouetteRenderer.d.ts.map