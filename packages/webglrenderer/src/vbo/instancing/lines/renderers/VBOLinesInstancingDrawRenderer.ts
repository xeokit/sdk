import {VBOInstancingLayer} from "../../VBOInstancingLayer";
import {VBOInstancingRenderer} from "../../VBOInstancingRenderer";

/**
 * @private
 */
export class VBOLinesInstancingDrawRenderer extends VBOInstancingRenderer {

    getHash(): string {
        return this.slicingHash;
    }

    buildVertexShader(src: string[]):void {
        this.vertexHeader(src);
        this.vertexCommonDefs(src);
        this.vertexInstancingTransformDefs(src);
        this.vertexSlicingDefs(src);
        this.vertexDrawFlatColorDefs(src);
        src.push("void main(void) {");
        // colorFlag = NOT_RENDERED | COLOR_OPAQUE | COLOR_TRANSPARENT
        // renderPass = COLOR_OPAQUE
        src.push(`if ((int(flags) & 0xF) != renderPass) {`);
        src.push("   gl_Position = vec4(0.0, 0.0, 0.0, 0.0);"); // Cull vertex
        src.push("} else {");
        this.vertexInstancingTransformLogic(src);
        this.vertexDrawFlatColorLogic(src);
        this.vertexSlicingLogic(src);
        src.push("}");
        src.push("}");
    }

    buildFragmentShader(src: string[]) :void{
        this.fragmentHeader(src);
        this.fragmentPrecisionDefs(src);
        this.fragmentSlicingDefs(src);
        this.fragmentDrawFlatColorDefs(src);
        src.push("void main(void) {");
        this.fragmentSlicingLogic(src);
        this.fragmentDrawFlatColorLogic(src);
        src.push("}");
    }

    drawVBOInstancingLayerPrimitives(vboInstancingLayer: VBOInstancingLayer, renderPass: number): void {
        const gl = this.renderContext.gl;
        const renderState = vboInstancingLayer.renderState;
        gl.drawElementsInstanced(gl.LINES, renderState.indicesBuf.numItems, renderState.indicesBuf.itemType, 0, renderState.numInstances);
    }
}
