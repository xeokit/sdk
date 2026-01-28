import { VBOBatchingRenderer } from "../../VBOBatchingRenderer";
/**
 * @private
 */
export class VBOLinesBatchingSilhouetteRenderer extends VBOBatchingRenderer {
    getHash() {
        return this.slicingHash;
    }
    buildVertexShader(src) {
        this.vertexHeader(src);
        this.vertexCommonDefs(src);
        this.vertexBatchingTransformDefs(src);
        this.vertexSlicingDefs(src);
        this.vertexDrawSilhouetteDefs(src);
        this.vertexSilhouetteMainOpen(src);
        {
            this.vertexDrawBatchingTransformLogic(src);
            this.vertexDrawSilhouetteLogic(src);
            this.vertexSlicingLogic(src);
            src.push("}");
        }
        src.push("}");
    }
    buildFragmentShader(src) {
        this.fragmentHeader(src);
        this.fragmentPrecisionDefs(src);
        this.fragmentCommonDefs(src);
        this.fragmentSlicingDefs(src);
        this.fragmentSilhouetteDefs(src);
        src.push("void main(void) {");
        this.fragmentSlicingLogic(src);
        this.fragmentDrawSilhouetteLogic(src);
        this.fragmentCommonOutput(src);
        src.push("}");
    }
    drawVBOBatchingLayerPrimitives(vboBatchingLayer, renderPass) {
        const gl = this.renderContext.gl;
        const renderState = vboBatchingLayer.renderState;
        gl.drawElements(gl.LINES, renderState.indicesBuf.numItems, renderState.indicesBuf.itemType, 0);
    }
}
//# sourceMappingURL=VBOLinesBatchingSilhouetteRenderer.js.map
