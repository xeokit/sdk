import {createRTCViewMat} from "../../../rtc";
import {RENDER_PASSES} from "../../RENDER_PASSES";
import type {VBOBatchingLayer} from "./VBOBatchingLayer";
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
    const view = this.renderContext.view;
    const viewIndex = view.viewIndex;
    const gl = this.renderContext.gl;
    if (attributes.tile) {
      attributes.tile.bindArrayBuffer(renderState.tilesBuf);
    }
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
    gl.uniform3fv(this.uniforms.positionsDecompressOffset, <any>renderState.positionsDecompressOffset);
    gl.uniform3fv(this.uniforms.positionsDecompressScale, <any>renderState.positionsDecompressScale);
    // gl.uniformMatrix4fv(this.uniforms.viewMatrix, false,
    //   <Float32Array | GLfloat[]>createRTCViewMat(
    //     renderPass === RENDER_PASSES.PICK
    //       ? this.renderContext.pickViewMatrix
    //       : this.renderContext.view.camera.viewMatrix,
    //     renderState.origin));
    if (renderState.indicesBuf) {
      renderState.indicesBuf.bind();
    }
    this.drawVBOBatchingLayerPrimitives(vboBatchingLayer, renderPass);
  }

  abstract drawVBOBatchingLayerPrimitives(vboBatchingLayer: VBOBatchingLayer, renderPass: number);
}
