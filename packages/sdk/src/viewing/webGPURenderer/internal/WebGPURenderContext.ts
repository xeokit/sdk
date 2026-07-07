import type {WebGPUBufferLike, WebGPUDeviceLike, WebGPUTextureLike} from "../core";
import {DEPTH_FORMAT, GPU_BUFFER_USAGE, GPU_TEXTURE_USAGE} from "./constants";

/**
 * Shared WebGPU device context used by the internal renderer managers.
 *
 * @internal
 */
export class WebGPURenderContext {

  public readonly device: WebGPUDeviceLike;
  public readonly contextFormat: string;

  constructor(params: {
    device: WebGPUDeviceLike;
    contextFormat: string;
  }) {
    this.device = params.device;
    this.contextFormat = params.contextFormat;
  }

  public createGPUBuffer(label: string, data: ArrayBufferView, usage: number): WebGPUBufferLike {
    const uploadData = this._createAlignedUploadData(data);
    const buffer = this.device.createBuffer({
      label,
      size: uploadData.byteLength,
      usage: usage | GPU_BUFFER_USAGE.COPY_DST
    });
    this.device.queue.writeBuffer(buffer, 0, uploadData);
    return buffer;
  }

  public createDepthTexture(label: string, width: number, height: number): WebGPUTextureLike {
    return this.device.createTexture({
      label,
      size: {
        width,
        height,
        depthOrArrayLayers: 1
      },
      format: DEPTH_FORMAT,
      usage: GPU_TEXTURE_USAGE.RENDER_ATTACHMENT
    });
  }

  private _alignTo4(value: number): number {
    return (value + 3) & ~3;
  }

  private _createAlignedUploadData(data: ArrayBufferView): ArrayBufferView {
    const alignedByteLength = Math.max(4, this._alignTo4(data.byteLength));
    if (alignedByteLength === data.byteLength) {
      return data;
    }
    const uploadData = new Uint8Array(alignedByteLength);
    uploadData.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    return uploadData;
  }
}
