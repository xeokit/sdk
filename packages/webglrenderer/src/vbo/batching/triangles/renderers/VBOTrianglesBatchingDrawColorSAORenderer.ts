import {VBOBatchingLayer} from "../../VBOBatchingLayer";
import {VBOBatchingRenderer} from "../../VBOBatchingRenderer";

/**
 * @private
 */
export class VBOTrianglesBatchingDrawColorSAORenderer extends VBOBatchingRenderer {

    getHash(): string {
        const view = this.renderContext.view;
        return `${view.getLightsHash()}-${view.getSectionPlanesHash()}`;
    }

    buildVertexShader(src: string[]):void {
        this.vertexHeader(src);
        this.vertexCommonDefs(src);
        this.vertexBatchingTransformDefs(src);
        this.vertexSlicingDefs(src);
        this.vertexDrawLambertDefs(src);
        this.vertexDrawMainOpen(src);
        {
            this.vertexDrawBatchingTransformLogic(src);
            this.vertexDrawLambertLogic(src);
            this.vertexSlicingLogic(src);
        }
        this.vertexMainClose(src);
    }

    buildFragmentShader(src: string[]) :void{
        this.fragmentHeader(src);
        this.fragmentPrecisionDefs(src);
        this.fragmentCommonDefs(src);
        this.fragmentSlicingDefs(src);
        this.fragmentDrawLambertDefs(src);
        this.fragmentDrawSAODefs(src);
        src.push("void main(void) {");
        {
            this.fragmentSlicingLogic(src);
            this.fragmentDrawLambertLogic(src);
            this.fragmentDrawSAOLogic(src);
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
