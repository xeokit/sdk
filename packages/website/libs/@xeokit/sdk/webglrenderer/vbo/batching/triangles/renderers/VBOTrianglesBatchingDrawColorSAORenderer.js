import { VBOBatchingRenderer } from "../../VBOBatchingRenderer";
/**
 * @private
 */
export class VBOTrianglesBatchingDrawColorSAORenderer extends VBOBatchingRenderer {
    getHash() {
        const view = this.renderContext.view;
        return `${view.getLightsHash()}-${view.getSectionPlanesHash()}`;
    }
    buildVertexShader(src) {
        this.vertexHeader(src);
        this.vertexCommonDefs(src);
        this.vertexBatchingTransformDefs(src);
        this.vertexSlicingDefs(src);
        this.vertexLambertShadingDefs(src);
        this.vertexDrawMainOpen(src);
        {
            this.vertexDrawBatchingTransformLogic(src);
            this.vertexLambertShadingLogic(src);
            this.vertexSlicingLogic(src);
        }
        this.vertexMainClose(src);
    }
    buildFragmentShader(src) {
        this.fragmentHeader(src);
        this.fragmentPrecisionDefs(src);
        this.fragmentCommonDefs(src);
        this.fragmentSlicingDefs(src);
        this.fragmentLambertShadingDefs(src);
        this.fragmentDrawSAODefs(src);
        src.push("void main(void) {");
        {
            this.fragmentSlicingLogic(src);
            this.fragmentLambertShadingLogic(src);
            this.fragmentDrawSAOLogic(src);
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
//# sourceMappingURL=VBOTrianglesBatchingDrawColorSAORenderer.js.map