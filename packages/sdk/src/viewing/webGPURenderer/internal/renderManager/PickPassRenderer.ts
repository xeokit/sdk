import type {SDKResult} from "../../../../base/core";
import type {WebGPUBindGroupLike, WebGPURenderPassEncoderLike} from "../../core";
import type {DrawOp, InstancedDrawBatch} from "../drawOps";
import type {RenderContext} from "../RenderContext";
import type {WebGPUPickBuffer, WebGPUReadbackBufferReader} from "../webGPU";

/**
 * Runs the offscreen WebGPU mesh-pick pass and returns the encoded mesh slot.
 *
 * @internal
 */
export class PickPassRenderer {

  private readonly _renderContext: RenderContext;
  private readonly _readbackBufferReader: WebGPUReadbackBufferReader;

  constructor(params: {
    renderContext: RenderContext;
    readbackBufferReader: WebGPUReadbackBufferReader;
  }) {
    this._renderContext = params.renderContext;
    this._readbackBufferReader = params.readbackBufferReader;
  }

  public async renderEncodedSlot(params: {
    pickBuffer: WebGPUPickBuffer;
    canvasPos: ArrayLike<number>;
    width: number;
    height: number;
    frameBindGroup: WebGPUBindGroupLike;
    instanceBindGroup: WebGPUBindGroupLike;
    batches: InstancedDrawBatch[];
    drawOp: DrawOp;
  }): Promise<SDKResult<number>> {
    const commandEncoder = this._renderContext.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass(params.pickBuffer.createPickPassDescriptor());
    const drawResult = params.drawOp.drawBatches({
      passEncoder,
      frameBindGroup: params.frameBindGroup,
      instanceBindGroup: params.instanceBindGroup,
      batches: params.batches
    });
    if (drawResult.ok === false) {
      return drawResult;
    }
    this._endRenderPass(passEncoder);

    const x = Math.max(0, Math.min(params.width - 1, Math.floor(params.canvasPos[0])));
    const y = Math.max(0, Math.min(params.height - 1, Math.floor(params.canvasPos[1])));
    return this._readbackBufferReader.copyMapAndDecode({
      commandEncoder,
      sourceTexture: params.pickBuffer.colorTexture,
      sourceOrigin: {
        x,
        y,
        z: 0
      },
      destination: params.pickBuffer.getCopyDestination(),
      readbackBuffer: params.pickBuffer.readbackBuffer,
      copySize: {
        width: 1,
        height: 1,
        depthOrArrayLayers: 1
      },
      errorPrefix: "RenderManager.pickMeshGPUAsync",
      decode: (bytes) => decodePickSlot(bytes)
    });
  }

  private _endRenderPass(passEncoder: WebGPURenderPassEncoderLike): void {
    if (typeof passEncoder.end === "function") {
      passEncoder.end();
      return;
    }
    passEncoder.endPass?.();
  }
}

export function decodePickSlot(bytes: Uint8Array): number {
  return (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0;
}
