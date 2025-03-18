import { VBOInstancingRenderer } from "../../VBOInstancingRenderer";
/**
 * @private
 */
export class VBOTrianglesInstancingDrawColorRenderer extends VBOInstancingRenderer {
    getHash() {
        return `${this.lambertShadingHash}-${this.slicingHash}`;
    }
    buildVertexShader(src) {
        this.vertexHeader(src);
        this.vertexCommonDefs(src);
        this.vertexInstancingTransformDefs(src);
        this.vertexSlicingDefs(src);
        this.vertexDrawLambertDefs(src);
        this.vertexDrawMainOpen(src);
        {
            this.vertexDrawInstancingTransformLogic(src);
            this.vertexDrawLambertLogic(src);
            this.vertexSlicingLogic(src);
        }
        this.vertexMainClose(src);
    }
    buildFragmentShader(src) {
        this.fragmentHeader(src);
        this.fragmentPrecisionDefs(src);
        this.fragmentCommonDefs(src);
        this.fragmentSlicingDefs(src);
        this.fragmentDrawLambertDefs(src);
        src.push("void main(void) {");
        {
            this.fragmentSlicingLogic(src);
            this.fragmentDrawLambertLogic(src);
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
//# sourceMappingURL=VBOTrianglesInstancingDrawColorRenderer.js.map