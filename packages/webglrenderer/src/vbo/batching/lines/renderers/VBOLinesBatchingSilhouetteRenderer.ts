import {VBOBatchingLayer} from "../../VBOBatchingLayer";
import {VBOBatchingRenderer} from "../../VBOBatchingRenderer";

/**
 * @private
 */
export class VBOLinesBatchingSilhouetteRenderer extends VBOBatchingRenderer {

    getHash(): string {
        return this.slicingHash;
    }

    buildVertexShader(src: string[]) :void{
        this.vertexHeader(src);
        this.vertexCommonDefs(src);
        this.vertexBatchingTransformDefs(src);
        this.vertexSlicingDefs(src);
        this.vertexSilhouetteDefs(src);
        this.vertexSilhouetteMainOpen(src);
        {
            this.vertexDrawBatchingTransformLogic(src);
            this.vertexSilhouetteLogic(src);
            this.vertexSlicingLogic(src);
            src.push("}");
        }
        src.push("}");
    }

    buildFragmentShader(src: string[]):void {
        this.fragmentHeader(src);
        this.fragmentPrecisionDefs(src);
        this.fragmentCommonDefs(src);
        this.fragmentSlicingDefs(src);
        this.fragmentSilhouetteDefs(src);
        src.push("void main(void) {");
        this.fragmentSlicingLogic(src);
        this.fragmentSilhouetteLogic(src);
        this.fragmentCommonOutput(src);
        src.push("}");
    }

    drawVBOBatchingLayerPrimitives(vboBatchingLayer: VBOBatchingLayer, renderPass: number): void {
        const gl = this.renderContext.gl;
        const renderState = vboBatchingLayer.renderState;
        gl.drawElements(gl.LINES, renderState.indicesBuf.numItems, renderState.indicesBuf.itemType, 0);
    }
}
