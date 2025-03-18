import { VBOBatchingRenderer } from "../../VBOBatchingRenderer";
/**
 * @private
 */
export class VBOTrianglesBatchingDrawDepthRenderer extends VBOBatchingRenderer {
    getHash() {
        return `${this.slicingHash}`;
    }
    buildVertexShader(src) {
        this.vertexHeader(src);
        this.vertexCommonDefs(src);
        this.vertexBatchingTransformDefs(src);
        this.vertexSlicingDefs(src);
        this.vertexDrawMainOpen(src);
        {
            this.vertexDrawBatchingTransformLogic(src);
            this.vertexSlicingLogic(src);
        }
        this.vertexMainClose(src);
    }
    buildFragmentShader(src) {
        this.fragmentHeader(src);
        this.fragmentPrecisionDefs(src);
        this.fragmentCommonDefs(src);
        this.fragmentDrawDepthDefs(src);
        this.fragmentSlicingDefs(src);
        src.push("void main(void) {");
        {
            this.fragmentSlicingLogic(src);
            this.fragmentDrawDepthLogic(src);
            this.fragmentCommonOutput(src);
        }
        src.push("}");
    }
    drawVBOBatchingLayerPrimitives(vboBatchingLayer, renderPass) {
        const gl = this.renderContext.gl;
        const renderState = vboBatchingLayer.renderState;
        gl.drawElements(gl.TRIANGLES, renderState.indicesBuf.numItems, renderState.indicesBuf.itemType, 0);
    }
}
//# sourceMappingURL=VBOTrianglesBatchingDrawDepthRenderer.js.map