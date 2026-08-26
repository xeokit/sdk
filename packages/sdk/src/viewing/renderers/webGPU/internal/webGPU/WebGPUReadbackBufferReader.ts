import {SDKErrorType, type SDKResult} from "../../../../../base/core";
import type {WebGPUBufferLike, WebGPUCommandEncoderLike} from "../../core";
import type {RenderContext} from "../RenderContext";

export interface WebGPUReadbackCopyDestination {
  buffer: WebGPUBufferLike;
  bytesPerRow: number;
  rowsPerImage: number;
}

/**
 * Runs a WebGPU texture-to-buffer copy and maps the readback buffer.
 *
 * @internal
 */
export class WebGPUReadbackBufferReader {

  private readonly _renderContext: RenderContext;

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
  }

  public async copyMapAndDecode<T>(params: {
    commandEncoder: WebGPUCommandEncoderLike;
    sourceTexture: unknown;
    sourceOrigin: {x: number; y: number; z: number};
    destination: WebGPUReadbackCopyDestination | null;
    readbackBuffer: WebGPUBufferLike | null;
    copySize: {width: number; height: number; depthOrArrayLayers: number};
    errorPrefix: string;
    decode: (bytes: Uint8Array, destination: WebGPUReadbackCopyDestination) => T;
  }): Promise<SDKResult<T>> {
    const destination = params.destination;
    const readbackBuffer = params.readbackBuffer;
    if (!destination || !readbackBuffer?.mapAsync || !readbackBuffer.getMappedRange || !readbackBuffer.unmap) {
      return {
        ok: false,
        type: SDKErrorType.NotSupported,
        error: `[${params.errorPrefix}] WebGPU readback buffer mapping is not available.`
      };
    }
    if (!params.commandEncoder.copyTextureToBuffer) {
      return {
        ok: false,
        type: SDKErrorType.NotSupported,
        error: `[${params.errorPrefix}] WebGPU copyTextureToBuffer is not available.`
      };
    }

    params.commandEncoder.copyTextureToBuffer(
      {
        texture: params.sourceTexture,
        origin: params.sourceOrigin
      },
      destination,
      params.copySize
    );
    this._renderContext.device.queue.submit([params.commandEncoder.finish()]);

    let mapped = false;
    try {
      await readbackBuffer.mapAsync(1);
      mapped = true;
      const bytes = new Uint8Array(readbackBuffer.getMappedRange());
      return {
        ok: true,
        value: params.decode(bytes, destination)
      };
    } finally {
      if (mapped) {
        readbackBuffer.unmap();
      }
    }
  }
}
