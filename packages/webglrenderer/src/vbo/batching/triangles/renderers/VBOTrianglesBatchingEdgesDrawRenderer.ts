import {VBOBatchingLayer} from "../../VBOBatchingLayer";
import {VBOBatchingRenderer} from "../../VBOBatchingRenderer";
import {RenderContext} from "../../../../RenderContext";

/**
 * @private
 */
export class VBOTrianglesBatchingEdgesDrawRenderer extends VBOBatchingRenderer {

    constructor(renderContext: RenderContext) {
        super(renderContext, { edges: true});
    }

    getHash(): string {
        return this.slicingHash;
    }

    buildVertexShader(src: string[]): void {
        this.vertexHeader(src);
        this.vertexCommonDefs(src);
        this.vertexBatchingTransformDefs(src);
        this.vertexSlicingDefs(src);
        this.vertexDrawFlatColorDefs(src);
        this.vertexDrawMainOpen(src);
        {
            this.vertexDrawBatchingTransformLogic(src);
            this.vertexDrawEdgesColorLogic(src);
            this.vertexSlicingLogic(src);
        }
        this.vertexMainClose(src);
    }

    buildFragmentShader(src: string[]): void {
        this.fragmentHeader(src);
        this.fragmentPrecisionDefs(src);
        this.fragmentCommonDefs(src);
        this.fragmentSlicingDefs(src);
        this.fragmentDrawFlatColorDefs(src);
        src.push("void main(void) {");
        {
            this.fragmentSlicingLogic(src);
            this.fragmentDrawFlatColorLogic(src);
            this.fragmentCommonOutput(src);
        }
        src.push("}");
    }

    drawVBOBatchingLayerPrimitives(vboBatchingLayer: VBOBatchingLayer, renderPass: number): void {
        const gl = this.renderContext.gl;
        const renderState = vboBatchingLayer.renderState;
        gl.drawElements(gl.LINES, renderState.edgeIndicesBuf.numItems, renderState.edgeIndicesBuf.itemType, 0);
    }
}
