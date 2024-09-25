import {VBOBatchingLayer} from "../../VBOBatchingLayer";
import {VBOBatchingRenderer} from "../../VBOBatchingRenderer";

/**
 * @private
 */
export class VBOTrianglesBatchingDrawDepthRenderer extends VBOBatchingRenderer {

    getHash(): string {
        return `${this.slicingHash}`;
    }

    buildVertexShader(src: string[]): void {
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

    buildFragmentShader(src: string[]): void {
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

    drawVBOBatchingLayerPrimitives(vboBatchingLayer: VBOBatchingLayer, renderPass: number): void {
        const gl = this.renderContext.gl;
        const renderState = vboBatchingLayer.renderState;
        gl.drawElements(gl.TRIANGLES, renderState.indicesBuf.numItems, renderState.indicesBuf.itemType, 0);
    }
}
