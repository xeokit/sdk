import {VBOBatchingLayer} from "../../VBOBatchingLayer";
import {VBOBatchingRenderer} from "../../VBOBatchingRenderer";

/**
 * @private
 */
export class VBOTrianglesBatchingDrawRenderer extends VBOBatchingRenderer {

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
        this.vertexColorMainOpenBlock(src);
        {
            this.vertexDrawBatchingTransformLogic(src);
            this.vertexDrawLambertLogic(src);
            this.vertexSlicingLogic(src);
        }
        this.vertexColorMainCloseBlock(src);
    }

    buildFragmentShader(src: string[]) :void{
        this.fragmentHeader(src);
        this.fragmentPrecisionDefs(src);
        this.fragmentSlicingDefs(src);
        this.fragmentDrawLambertDefs(src);
        src.push("void main(void) {");
        {
            this.fragmentSlicingLogic(src);
            this.fragmentDrawLambertLogic(src);
        }
        src.push("}");
    }

    drawVBOBatchingLayerPrimitives(vboBatchingLayer: VBOBatchingLayer, renderPass: number): void {
        const gl = this.renderContext.gl;
        const renderState = vboBatchingLayer.renderState;
        gl.drawElements(gl.TRIANGLES, renderState.indicesBuf.numItems, renderState.indicesBuf.itemType, 0);
    }
}
