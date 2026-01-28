import { VBOInstancingRenderer } from "../../VBOInstancingRenderer";
/**
 * @private
 */
export class VBOTrianglesInstancingSilhouetteRenderer extends VBOInstancingRenderer {
    getHash() {
        return this.slicingHash;
    }
    buildVertexShader(src) {
        this.vertexHeader(src);
        this.vertexCommonDefs(src);
        this.vertexInstancingTransformDefs(src);
        this.vertexSlicingDefs(src);
        this.vertexDrawSilhouetteDefs(src);
        this.vertexSilhouetteMainOpen(src);
        {
            this.vertexDrawInstancingTransformLogic(src);
            this.vertexDrawSilhouetteLogic(src);
            this.vertexSlicingLogic(src);
        }
        this.vertexMainClose(src);
    }
    buildFragmentShader(src) {
        this.fragmentHeader(src);
        this.fragmentPrecisionDefs(src);
        this.fragmentCommonDefs(src);
        this.fragmentSlicingDefs(src);
        this.fragmentSilhouetteDefs(src);
        src.push("void main(void) {");
        {
            this.fragmentSlicingLogic(src);
            this.fragmentDrawSilhouetteLogic(src);
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
//# sourceMappingURL=VBOTrianglesInstancingSilhouetteRenderer.js.map
