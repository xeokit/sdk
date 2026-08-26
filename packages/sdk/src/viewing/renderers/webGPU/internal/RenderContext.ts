import type {WebGPUBindGroupLike, WebGPUBufferLike, WebGPUDeviceLike, WebGPUSamplerLike, WebGPUTextureLike} from "../core";
import type {MemoryConfigs} from "../MemoryConfigs";
import type {WebGPURenderConfigs} from "../WebGPURenderConfigs";
import {DEPTH_FORMAT, GPU_BUFFER_USAGE, GPU_TEXTURE_USAGE} from "./constants";

/**
 * Shared WebGPU device context used by the internal renderer managers.
 *
 * @internal
 */
export class RenderContext {

  public readonly device: WebGPUDeviceLike;
  public readonly contextFormat: string;
  public colorTargetFormat: string;
  public readonly memoryConfigs: MemoryConfigs;
  public readonly renderConfigs: WebGPURenderConfigs;
  public shadowBindGroup: WebGPUBindGroupLike | null = null;
  public iblUniformBuffer: WebGPUBufferLike | null = null;
  public iblSampler: WebGPUSamplerLike | null = null;
  public iblIrradianceView: unknown = null;
  public iblPrefilteredView: unknown = null;
  public iblBRDFLUTView: unknown = null;
  public iblBindGroupVersion = 0;

  constructor(params: {
    device: WebGPUDeviceLike;
    contextFormat: string;
    memoryConfigs: MemoryConfigs;
    renderConfigs: WebGPURenderConfigs;
  }) {
    this.device = params.device;
    this.contextFormat = params.contextFormat;
    this.colorTargetFormat = params.contextFormat;
    this.memoryConfigs = params.memoryConfigs;
    this.renderConfigs = params.renderConfigs;
  }

  public createGPUBuffer(label: string, data: ArrayBufferView, usage: number): WebGPUBufferLike {
    const uploadData = this._createAlignedUploadData(data);
    const buffer = this.device.createBuffer({
      label,
      size: uploadData.byteLength,
      usage: usage | GPU_BUFFER_USAGE.COPY_DST,
      mappedAtCreation: true
    });
    if (buffer.getMappedRange && buffer.unmap) {
      new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(uploadData.buffer, uploadData.byteOffset, uploadData.byteLength));
      buffer.unmap();
      return buffer;
    }
    this.device.queue.writeBuffer(buffer, 0, uploadData);
    return buffer;
  }

  public createEmptyGPUBuffer(label: string, byteLength: number, usage: number): WebGPUBufferLike {
    return this.device.createBuffer({
      label,
      size: Math.max(4, this._alignTo4(byteLength)),
      usage: usage | GPU_BUFFER_USAGE.COPY_DST
    });
  }

  public writeGPUBuffer(buffer: WebGPUBufferLike, bufferOffset: number, data: ArrayBufferView): void {
    this.device.queue.writeBuffer(buffer, bufferOffset, this._createAlignedUploadData(data));
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
      usage: GPU_TEXTURE_USAGE.RENDER_ATTACHMENT | GPU_TEXTURE_USAGE.TEXTURE_BINDING
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
