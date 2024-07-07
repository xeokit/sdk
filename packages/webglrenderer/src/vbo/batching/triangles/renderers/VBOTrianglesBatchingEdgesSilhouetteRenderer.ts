import {VBOBatchingLayer} from "../../VBOBatchingLayer";
import {VBOBatchingRenderer} from "../../VBOBatchingRenderer";

/**
 * @private
 */
export class VBOTrianglesBatchingEdgesSilhouetteRenderer extends VBOBatchingRenderer {

    getHash(): string {
        const view = this.renderContext.view;
        return `${view.getLightsHash()}-${view.getSectionPlanesHash()}`;
    }

    buildVertexShader(src: string[]):void {
        this.vertexHeader(src);
        this.vertexCommonDefs(src);
        this.vertexBatchingTransformDefs(src);
        this.vertexSlicingDefs(src);
        this.vertexDrawEdgesSilhouetteDefs(src);
        this.openVertexEdgesMain(src);
        {
            this.vertexBatchingTransformLogic(src);
            this.vertexDrawEdgesSilhouetteLogic(src);
            this.vertexSlicingLogic(src);
        }
        this.closeVertexMain(src);
    }

    buildFragmentShader(src: string[]) :void{
        this.fragmentHeader(src);
        this.fragmentPrecisionDefs(src);
        this.fragmentSlicingDefs(src);
        this.fragmentDrawEdgesSilhouetteDefs(src);
        src.push("void main(void) {");
        {
            this.fragmentSlicingLogic(src);
            this.fragmentDrawEdgesSilhouetteLogic(src);
        }
        src.push("}");
    }

    drawVBOBatchingLayerPrimitives(vboBatchingLayer: VBOBatchingLayer, renderPass: number): void {
        const gl = this.renderContext.gl;
        const renderState = vboBatchingLayer.renderState;
        gl.drawElements(gl.LINES, renderState.edgeIndicesBuf.numItems, renderState.edgeIndicesBuf.itemType, 0);
    }
}
