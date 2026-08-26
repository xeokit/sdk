import type {SDKResult} from "../../../../../base/core";
import type {WebGPUBindGroupLike, WebGPURenderPassEncoderLike} from "../../core";
import type {DrawOp, InstancedDrawBatch} from "../drawOps";
import type {RenderContext} from "../RenderContext";
import type {WebGPUReadbackBufferReader, WebGPUSnapBuffer} from "../webGPU";
import {decodePickSlot} from "./PickPassRenderer";

/**
 * Runs the offscreen WebGPU snap pass and returns the nearest encoded mesh slot.
 *
 * @internal
 */
export class SnapPassRenderer {

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
    snapBuffer: WebGPUSnapBuffer;
    frameBindGroup: WebGPUBindGroupLike;
    instanceBindGroup: WebGPUBindGroupLike;
    depthPrepassBatches: InstancedDrawBatch[];
    candidateBatches: InstancedDrawBatch[];
    depthPrepassDrawOp: DrawOp;
    candidateDrawOp: DrawOp;
    errorPrefix: string;
  }): Promise<SDKResult<number>> {
    const commandEncoder = this._renderContext.device.createCommandEncoder();
    const depthPrepassEncoder = commandEncoder.beginRenderPass(params.snapBuffer.createDepthPrepassDescriptor());
    const depthPrepassResult = params.depthPrepassDrawOp.drawBatches({
      passEncoder: depthPrepassEncoder,
      frameBindGroup: params.frameBindGroup,
      instanceBindGroup: params.instanceBindGroup,
      batches: params.depthPrepassBatches
    });
    if (depthPrepassResult.ok === false) {
      return depthPrepassResult;
    }
    this._endRenderPass(depthPrepassEncoder);

    const passEncoder = commandEncoder.beginRenderPass(params.snapBuffer.createSnapPassDescriptor());
    const drawResult = params.candidateDrawOp.drawBatches({
      passEncoder,
      frameBindGroup: params.frameBindGroup,
      instanceBindGroup: params.instanceBindGroup,
      batches: params.candidateBatches
    });
    if (drawResult.ok === false) {
      return drawResult;
    }
    this._endRenderPass(passEncoder);

    const dimension = params.snapBuffer.dimension;
    return this._readbackBufferReader.copyMapAndDecode({
      commandEncoder,
      sourceTexture: params.snapBuffer.colorTexture,
      sourceOrigin: {
        x: 0,
        y: 0,
        z: 0
      },
      destination: params.snapBuffer.getCopyDestination(),
      readbackBuffer: params.snapBuffer.readbackBuffer,
      copySize: {
        width: dimension,
        height: dimension,
        depthOrArrayLayers: 1
      },
      errorPrefix: params.errorPrefix,
      decode: (bytes, destination) => findNearestEncodedSlot(bytes, destination.bytesPerRow, dimension)
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

function findNearestEncodedSlot(bytes: Uint8Array, bytesPerRow: number, dimension: number): number {
  const center = Math.floor(dimension / 2);
  let bestSlot = 0;
  let bestDistanceSq = Number.POSITIVE_INFINITY;
  for (let y = 0; y < dimension; y++) {
    for (let x = 0; x < dimension; x++) {
      const offset = y * bytesPerRow + x * 4;
      const slot = decodePickSlot(bytes.subarray(offset, offset + 4));
      if (slot === 0) {
        continue;
      }
      const dx = x - center;
      const dy = y - center;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq;
        bestSlot = slot;
      }
    }
  }
  return bestSlot;
}
