import { VBOInstancingRenderer } from "../../VBOInstancingRenderer";
/**
 * @private
 */
export class VBOLinesInstancingDrawColorRenderer extends VBOInstancingRenderer {
    getHash() {
        return this.slicingHash;
    }
    buildVertexShader(src) {
        this.vertexHeader(src);
        this.vertexCommonDefs(src);
        this.vertexInstancingTransformDefs(src);
        this.vertexSlicingDefs(src);
        this.vertexDrawFlatColorDefs(src);
        this.vertexDrawMainOpen(src);
        {
            this.vertexDrawInstancingTransformLogic(src);
            this.vertexDrawFlatColorLogic(src);
            this.vertexSlicingLogic(src);
        }
        this.vertexMainClose(src);
    }
    buildFragmentShader(src) {
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
    drawVBOInstancingLayerPrimitives(vboInstancingLayer, renderPass) {
        const gl = this.renderContext.gl;
        const renderState = vboInstancingLayer.renderState;
        gl.drawElementsInstanced(gl.LINES, renderState.indicesBuf.numItems, renderState.indicesBuf.itemType, 0, renderState.numInstances);
    }
}
//# sourceMappingURL=VBOLinesInstancingDrawColorRenderer.js.map