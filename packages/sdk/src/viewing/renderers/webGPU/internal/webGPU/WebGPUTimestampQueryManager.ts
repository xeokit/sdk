import type {WebGPUBufferLike, WebGPUCommandEncoderLike, WebGPUQuerySetLike} from "../../core";
import {GPU_BUFFER_USAGE} from "../constants";
import type {RenderContext} from "../RenderContext";
import type {RenderInspector} from "../inspectors";

export interface WebGPUTimestampFrame {
  querySet: WebGPUQuerySetLike;
  resolveBuffer: WebGPUBufferLike;
  readbackBuffer: WebGPUBufferLike;
  passNames: string[];
}

/**
 * Owns optional WebGPU timestamp query resources for render-pass GPU timings.
 *
 * @internal
 */
export class WebGPUTimestampQueryManager {

  private readonly _renderContext: RenderContext;
  private _disabled = false;

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
  }

  public get supported(): boolean {
    const device = this._renderContext.device;
    return (
      this._renderContext.renderConfigs.gpuTimestamps &&
      !this._disabled &&
      !!device.features?.has?.("timestamp-query") &&
      !!device.createQuerySet
    );
  }

  public beginFrame(passNames: string[]): WebGPUTimestampFrame | null {
    if (!this.supported || passNames.length === 0) {
      return null;
    }

    const queryCount = passNames.length * 2;
    const byteLength = queryCount * 8;
    const device = this._renderContext.device;
    const querySet = device.createQuerySet!({
      label: "xeokit-webgpu-render-timestamp-query-set",
      type: "timestamp",
      count: queryCount
    });
    const resolveBuffer = device.createBuffer({
      label: "xeokit-webgpu-render-timestamp-resolve-buffer",
      size: byteLength,
      usage: GPU_BUFFER_USAGE.QUERY_RESOLVE | GPU_BUFFER_USAGE.COPY_SRC
    });
    const readbackBuffer = device.createBuffer({
      label: "xeokit-webgpu-render-timestamp-readback-buffer",
      size: byteLength,
      usage: GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.MAP_READ
    });

    return {
      querySet,
      resolveBuffer,
      readbackBuffer,
      passNames
    };
  }

  public createTimestampWrites(frame: WebGPUTimestampFrame | null, passName: string): object | undefined {
    if (!frame) {
      return undefined;
    }
    const passIndex = frame.passNames.indexOf(passName);
    if (passIndex < 0) {
      return undefined;
    }
    return {
      querySet: frame.querySet,
      beginningOfPassWriteIndex: passIndex * 2,
      endOfPassWriteIndex: passIndex * 2 + 1
    };
  }

  public resolveAndRead(params: {
    frame: WebGPUTimestampFrame | null;
    commandEncoder: WebGPUCommandEncoderLike;
    renderInspector: RenderInspector;
    viewIndex: number;
  }): void {
    const frame = params.frame;
    if (!frame) {
      return;
    }
    if (!params.commandEncoder.resolveQuerySet || !params.commandEncoder.copyBufferToBuffer) {
      this._disabled = true;
      this._destroyFrame(frame);
      return;
    }

    const byteLength = frame.passNames.length * 2 * 8;
    try {
      params.commandEncoder.resolveQuerySet(frame.querySet, 0, frame.passNames.length * 2, frame.resolveBuffer, 0);
      params.commandEncoder.copyBufferToBuffer(frame.resolveBuffer, 0, frame.readbackBuffer, 0, byteLength);
      params.renderInspector.markGPUTimesPending(params.viewIndex);
    } catch {
      this._disabled = true;
      this._destroyFrame(frame);
    }
  }

  public readResolvedFrame(params: {
    frame: WebGPUTimestampFrame | null;
    renderInspector: RenderInspector;
    viewIndex: number;
  }): void {
    const frame = params.frame;
    if (!frame) {
      return;
    }
    const readbackBuffer = frame.readbackBuffer;
    if (!readbackBuffer.mapAsync || !readbackBuffer.getMappedRange || !readbackBuffer.unmap) {
      this._disabled = true;
      this._destroyFrame(frame);
      return;
    }

    void readbackBuffer.mapAsync(1)
      .then(() => {
        const timestamps = new BigUint64Array(readbackBuffer.getMappedRange());
        const passes: {[passName: string]: number} = {};
        for (let i = 0, len = frame.passNames.length; i < len; i++) {
          const begin = timestamps[i * 2];
          const end = timestamps[i * 2 + 1];
          passes[frame.passNames[i]] = Number(end > begin ? end - begin : 0n) / 1000000;
        }
        params.renderInspector.setGPUTimes(params.viewIndex, passes);
      })
      .catch(() => {
        this._disabled = true;
      })
      .finally(() => {
        try {
          readbackBuffer.unmap?.();
        } finally {
          this._destroyFrame(frame);
        }
      });
  }

  private _destroyFrame(frame: WebGPUTimestampFrame): void {
    frame.querySet.destroy?.();
    frame.resolveBuffer.destroy?.();
    frame.readbackBuffer.destroy?.();
  }
}
