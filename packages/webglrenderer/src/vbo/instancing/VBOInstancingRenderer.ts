import {VBOInstancingLayer} from "./VBOInstancingLayer";
import {createRTCViewMat} from "@xeokit/rtc";
import {VBORenderer} from "../VBORenderer";
import {RENDER_PASSES} from "../../RENDER_PASSES";

/**
 * @private
 */
export abstract class VBOInstancingRenderer extends VBORenderer {

    renderVBOInstancingLayer(vboInstancingLayer: VBOInstancingLayer, renderPass: number): void {
        if (!this.bind(renderPass)) {
            return;
        }
        const attributes = this.attributes;
        const renderState = vboInstancingLayer.renderState;
        const view = this.renderContext.view;
        const viewIndex = view.viewIndex;
        const gl = this.renderContext.gl;
        gl.uniform1i(this.uniforms.renderPass, renderPass);
        attributes.position.bindArrayBuffer(renderState.positionsBuf);
        if (attributes.uv) {
            attributes.uv.bindArrayBuffer(renderState.uvBuf);
        }
        if (attributes.flags) {
            attributes.flags.bindArrayBuffer(renderState.flagsBufs[viewIndex]);
            gl.vertexAttribDivisor(attributes.flags.location, 1);
        }
        if (attributes.color) {
            attributes.color.bindArrayBuffer(renderState.colorsBuf[viewIndex]);
            gl.vertexAttribDivisor(attributes.color.location, 1);
        }
        if (attributes.pickColor) {
            attributes.pickColor.bindArrayBuffer(renderState.pickColorsBuf);
            gl.vertexAttribDivisor(attributes.pickColor.location, 1);
        }
        if (attributes.intensity) {
            // attributes.intensity.bindArrayBuffer(renderState.pointIntensitiesBuf);
        }
        if (attributes.modelMatrixCol0) {
            attributes.modelMatrixCol0.bindArrayBuffer(renderState.modelMatrixCol0Buf);
            gl.vertexAttribDivisor(attributes.modelMatrixCol0.location, 1);
        }
        if (attributes.modelMatrixCol1) {
            attributes.modelMatrixCol1.bindArrayBuffer(renderState.modelMatrixCol1Buf);
            gl.vertexAttribDivisor(attributes.modelMatrixCol1.location, 1);
        }
        if (attributes.modelMatrixCol2) {
            attributes.modelMatrixCol2.bindArrayBuffer(renderState.modelMatrixCol2Buf);
            gl.vertexAttribDivisor(attributes.modelMatrixCol2.location, 1);
        }
        gl.uniform3fv(this.uniforms.positionsDecompressOffset, <Float32Array | GLfloat[]>renderState.positionsDecompressOffset);
        gl.uniform3fv(this.uniforms.positionsDecompressScale, <Float32Array | GLfloat[]>renderState.positionsDecompressScale);
        gl.uniformMatrix4fv(this.uniforms.worldMatrix, false, <Float32Array | GLfloat[]>vboInstancingLayer.rendererModel.worldMatrix);
        gl.uniformMatrix4fv(this.uniforms.viewMatrix, false,
            <Float32Array | GLfloat[]>createRTCViewMat(
                renderPass === RENDER_PASSES.PICK
                    ? this.renderContext.pickViewMatrix
                    : this.renderContext.view.camera.viewMatrix,
                renderState.origin));
        if (renderState.indicesBuf) {
            renderState.indicesBuf.bind();
        }
        this.drawVBOInstancingLayerPrimitives(vboInstancingLayer, renderPass);
    }

    abstract drawVBOInstancingLayerPrimitives(vboInstancingLayer: VBOInstancingLayer, renderPass: number);
}
