import {VBOInstancingLayer} from "../../VBOInstancingLayer";
import {VBOInstancingRenderer} from "../../VBOInstancingRenderer";

/**
 * @private
 */
export class VBOTrianglesInstancingSilhouetteRenderer extends VBOInstancingRenderer {

    getHash(): string {
        return this.slicingHash;
    }

    buildVertexShader(src: string[]) {
        this.vertexHeader(src);
        this.vertexCommonDefs(src);
        this.vertexInstancingTransformDefs(src);
        this.vertexSlicingDefs(src);
        this.vertexSilhouetteShadingDefs(src);
        src.push("void main(void) {");
        // colorFlag = NOT_RENDERED | COLOR_OPAQUE | COLOR_TRANSPARENT
        // renderPass = COLOR_OPAQUE
        src.push(`int colorFlag = int(flags) & 0xF;`);
        src.push(`if (colorFlag != renderPass) {`);
        src.push("   gl_Position = vec4(0.0, 0.0, 0.0, 0.0);"); // Cull vertex
        src.push("} else {");
        this.vertexInstancingTransformLogic(src);
        this.vertexSilhouetteShadingLogic(src);
        this.vertexSlicingLogic(src);
        src.push("}");
        src.push("}");
    }

    buildFragmentShader(src: string[]) {
        this.fragmentHeader(src);
        this.fragmentPrecisionDefs(src);
        this.fragmentSlicingDefs(src);
        this.fragmentSilhouetteShadingDefs(src);
        src.push("void main(void) {");
        this.fragmentSlicingLogic(src);
        this.fragmentSilhouetteShadingLogic(src);
        src.push("}");
    }

    drawVBOInstancingLayer(vboInstancingLayer: VBOInstancingLayer, renderPass: number): void {
        const gl = this.renderContext.gl;
        const renderState = vboInstancingLayer.renderState;
        gl.drawElementsInstanced(gl.TRIANGLES, renderState.indicesBuf.numItems, renderState.indicesBuf.itemType, 0, renderState.numInstances);
    }
}
