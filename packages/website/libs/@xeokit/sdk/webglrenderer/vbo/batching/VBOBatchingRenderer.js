import { createRTCViewMat } from "../../../rtc";
import { VBORenderer } from "../VBORenderer";
import { RENDER_PASSES } from "../../RENDER_PASSES";
/**
 * @private
 */
export class VBOBatchingRenderer extends VBORenderer {
    renderVBOBatchingLayer(vboBatchingLayer, renderPass) {
        if (!this.bind(renderPass)) {
            return;
        }
        const attributes = this.attributes;
        const renderState = vboBatchingLayer.renderState;
        const view = this.renderContext.view;
        const viewIndex = view.viewIndex;
        const gl = this.renderContext.gl;
        attributes.position.bindArrayBuffer(renderState.positionsBuf);
        if (attributes.flags) {
            attributes.flags.bindArrayBuffer(renderState.flagsBufs[viewIndex]);
        }
        if (attributes.color) {
            attributes.color.bindArrayBuffer(renderState.colorsBuf[viewIndex]);
        }
        if (attributes.pickColor) {
            attributes.pickColor.bindArrayBuffer(renderState.pickColorsBuf);
        }
        if (attributes.intensity) {
            //attributes.intensity.bindArrayBuffer(renderState.pointIntensitiesBuf);
        }
        if (attributes.uv) {
            attributes.uv.bindArrayBuffer(renderState.uvBuf);
        }
        gl.uniform1i(this.uniforms.renderPass, renderPass);
        gl.uniform3fv(this.uniforms.positionsDecompressOffset, renderState.positionsDecompressOffset);
        gl.uniform3fv(this.uniforms.positionsDecompressScale, renderState.positionsDecompressScale);
        gl.uniformMatrix4fv(this.uniforms.worldMatrix, false, vboBatchingLayer.rendererModel.worldMatrix);
        gl.uniformMatrix4fv(this.uniforms.viewMatrix, false, createRTCViewMat(renderPass === RENDER_PASSES.PICK
            ? this.renderContext.pickViewMatrix
            : this.renderContext.view.camera.viewMatrix, renderState.origin));
        if (renderState.indicesBuf) {
            renderState.indicesBuf.bind();
        }
        this.drawVBOBatchingLayerPrimitives(vboBatchingLayer, renderPass);
    }
}
//# sourceMappingURL=VBOBatchingRenderer.js.map