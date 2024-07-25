import {VBOInstancingLayer} from "../../VBOInstancingLayer";
import {VBOInstancingRenderer} from "../../VBOInstancingRenderer";

/**
 * @private
 */
export class VBOLinesInstancingSilhouetteRenderer extends VBOInstancingRenderer {

    getHash(): string {
        return this.slicingHash;
    }

    buildVertexShader(src: string[]): void {
        this.vertexHeader(src);
        this.vertexCommonDefs(src);
        this.vertexInstancingTransformDefs(src);
        this.vertexSlicingDefs(src);
        this.vertexDrawSilhouetteDefs(src);
        this.openVertexSilhouetteMain(src);
        {
            this.vertexDrawInstancingTransformLogic(src);
            this.vertexDrawSilhouetteLogic(src);
            this.vertexSlicingLogic(src);
        }
        this.vertexColorMainCloseBlock(src);
    }

    buildFragmentShader(src: string[]): void {
        this.fragmentHeader(src);
        this.fragmentPrecisionDefs(src);
        this.fragmentSlicingDefs(src);
        this.fragmentDrawSilhouetteDefs(src);
        src.push("void main(void) {");
        this.fragmentSlicingLogic(src);
        this.fragmentDrawSilhouetteLogic(src);
        src.push("}");
    }

    drawVBOInstancingLayerPrimitives(vboInstancingLayer: VBOInstancingLayer, renderPass: number): void {
        const gl = this.renderContext.gl;
        const renderState = vboInstancingLayer.renderState;
        gl.drawElementsInstanced(gl.LINES, renderState.indicesBuf.numItems, renderState.indicesBuf.itemType, 0, renderState.numInstances);
    }
}
