import {VBOInstancingLayer} from "../../VBOInstancingLayer";
import {VBOInstancingRenderer} from "../../VBOInstancingRenderer";
import {RenderContext} from "../../../../RenderContext";

/**
 * @private
 */
export class VBOTrianglesInstancingEdgesDrawRenderer extends VBOInstancingRenderer {

    constructor(renderContext: RenderContext) {
        super(renderContext, { edges: true});
    }

    getHash(): string {
        return this.slicingHash;
    }

    buildVertexShader(src: string[]): void {
        this.vertexHeader(src);
        this.vertexCommonDefs(src);
        this.vertexInstancingTransformDefs(src);
        this.vertexSlicingDefs(src);
        this.vertexDrawEdgesColorDefs(src);
        this.vertexColorMainOpenBlock(src);
        {
            this.vertexDrawInstancingTransformLogic(src);
            this.vertexDrawEdgesColorLogic(src);
            this.vertexSlicingLogic(src);
        }
        this.vertexColorMainCloseBlock(src);
    }

    buildFragmentShader(src: string[]): void {
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
        gl.drawElementsInstanced(gl.LINES, renderState.edgeIndicesBuf.numItems, renderState.edgeIndicesBuf.itemType, 0, renderState.numInstances);
    }
}
