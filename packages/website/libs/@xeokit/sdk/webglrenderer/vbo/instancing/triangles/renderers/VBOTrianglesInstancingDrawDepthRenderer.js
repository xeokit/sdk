import { VBOInstancingRenderer } from "../../VBOInstancingRenderer";
/**
 * @private
 */
export class VBOTrianglesInstancingDrawDepthRenderer extends VBOInstancingRenderer {
    getHash() {
        return `${this.slicingHash}`;
    }
    buildVertexShader(src) {
        this.vertexHeader(src);
        this.vertexCommonDefs(src);
        this.vertexInstancingTransformDefs(src);
        this.vertexSlicingDefs(src);
        this.vertexDrawMainOpen(src);
        {
            this.vertexDrawInstancingTransformLogic(src);
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
    drawVBOInstancingLayerPrimitives(vboInstancingLayer, renderPass) {
        const gl = this.renderContext.gl;
        const renderState = vboInstancingLayer.renderState;
        gl.drawElementsInstanced(gl.TRIANGLES, renderState.indicesBuf.numItems, renderState.indicesBuf.itemType, 0, renderState.numInstances);
    }
}
//# sourceMappingURL=VBOTrianglesInstancingDrawDepthRenderer.js.map