import {VBOBatchingLayer} from "./VBOBatchingLayer";
import {createRTCViewMat} from "@xeokit/rtc";
import {VBORenderer} from "../VBORenderer";


/**
 * @private
 */
export abstract class VBOBatchingRenderer extends VBORenderer {

    renderVBOBatchingLayer(vboBatchingLayer: VBOBatchingLayer, renderPass: number): void {
        if (!this.bind(renderPass)) {
            return;
        }
        const attributes = this.attributes;
        const renderState = vboBatchingLayer.renderState;
        const gl = this.renderContext.gl;
        attributes.position.bindArrayBuffer(renderState.positionsBuf);
        if (attributes.flags) {
            attributes.flags.bindArrayBuffer(renderState.flagsBuf);
        }
        if (attributes.uv) {
            attributes.uv.bindArrayBuffer(renderState.uvBuf);
        }
        if (attributes.color) {
            attributes.color.bindArrayBuffer(renderState.colorsBuf);
        }
        if (attributes.pickColor) {
            attributes.pickColor.bindArrayBuffer(renderState.pickColorsBuf);
        }
        if (attributes.color) {
            attributes.color.bindArrayBuffer(renderState.colorsBuf);
        }
        if (attributes.intensity) {
            //attributes.intensity.bindArrayBuffer(renderState.pointIntensitiesBuf);
        }
        gl.uniform1i(this.uniforms.renderPass, renderPass);
        gl.uniformMatrix4fv(this.uniforms.positionsDecodeMatrix, false, <Float32Array | GLfloat[]>renderState.positionsDecodeMatrix);
        gl.uniformMatrix4fv(this.uniforms.worldMatrix, false, <Float32Array | GLfloat[]>vboBatchingLayer.rendererModel.worldMatrix);
        gl.uniformMatrix4fv(this.uniforms.viewMatrix, false, <Float32Array | GLfloat[]>createRTCViewMat(this.renderContext.view.camera.viewMatrix, renderState.origin));
        if (renderState.indicesBuf) {
            renderState.indicesBuf.bind();
        }
        this.drawVBOBatchingLayerPrimitives(vboBatchingLayer, renderPass);
    }

    abstract drawVBOBatchingLayerPrimitives(vboBatchingLayer: VBOBatchingLayer, renderPass: number);
}
