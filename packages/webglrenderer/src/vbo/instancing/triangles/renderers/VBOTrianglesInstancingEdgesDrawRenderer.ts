import {VBOInstancingLayer} from "../../VBOInstancingLayer";
import {VBOInstancingRenderer} from "../../VBOInstancingRenderer";

/**
 * @private
 */
export class VBOTrianglesInstancingEdgesDrawRenderer extends VBOInstancingRenderer {

    getHash(): string {
        const view = this.renderContext.view;
        return `${view.getLightsHash()}-${view.getSectionPlanesHash()}`;
    }

    buildVertexShader(src: string[]):void {
        this.vertexHeader(src);
        this.vertexCommonDefs(src);
        this.vertexInstancingTransformDefs(src);
        this.vertexSlicingDefs(src);
        this.vertexDrawEdgesColorDefs(src);
        this.openVertexEdgesMain(src);
        {
            this.vertexInstancingTransformLogic(src);
            this.vertexDrawEdgesColorLogic(src);
            this.vertexSlicingLogic(src);
        }
        this.closeVertexMain(src);
    }

    buildFragmentShader(src: string[]) :void{
        this.fragmentHeader(src);
        this.fragmentPrecisionDefs(src);
        this.fragmentSlicingDefs(src);
        this.fragmentDrawEdgesColorDefs(src);
        src.push("void main(void) {");
        {
            this.fragmentSlicingLogic(src);
            this.fragmentDrawEdgesColorLogic(src);
        }
        src.push("}");
    }

    drawVBOInstancingLayerPrimitives(vboInstancingLayer: VBOInstancingLayer, renderPass: number): void {
        const gl = this.renderContext.gl;
        const renderState = vboInstancingLayer.renderState;
        gl.drawElements(gl.LINES, renderState.edgeIndicesBuf.numItems, renderState.edgeIndicesBuf.itemType, 0);
    }
}
