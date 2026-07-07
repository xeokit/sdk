import {SDKErrorType, type SDKResult} from "../../../base/core";
import type {View} from "../../viewer";
import type {WebGPUBufferLike} from "../core";
import {GPU_BUFFER_USAGE, INSTANCE_BYTES, INSTANCE_FLOATS} from "./constants";
import type {WebGPUDrawItem} from "./types";
import {WebGPUMeshManager} from "./WebGPUMeshManager";
import {WebGPURenderContext} from "./WebGPURenderContext";

/**
 * Owns the per-frame instance stream used by batched mesh draws.
 *
 * @internal
 */
export class WebGPUInstanceBufferManager {

  private readonly _renderContext: WebGPURenderContext;
  private _buffer: WebGPUBufferLike | null = null;
  private _data: Float32Array = new Float32Array(0);
  private _capacity = 0;
  private _instanceCount = 0;

  constructor(renderContext: WebGPURenderContext) {
    this._renderContext = renderContext;
  }

  public get buffer(): WebGPUBufferLike | null {
    return this._buffer;
  }

  public beginFrame(instanceCount: number): SDKResult<void> {
    this._instanceCount = 0;
    if (instanceCount <= this._capacity) {
      return {
        ok: true,
        value: undefined
      };
    }

    let nextCapacity = Math.max(1, this._capacity);
    while (nextCapacity < instanceCount) {
      nextCapacity *= 2;
    }

    try {
      this._buffer?.destroy?.();
      this._buffer = this._renderContext.device.createBuffer({
        label: "xeokit-webgpu-instance-buffer",
        size: nextCapacity * INSTANCE_BYTES,
        usage: GPU_BUFFER_USAGE.VERTEX | GPU_BUFFER_USAGE.COPY_DST
      });
      this._data = new Float32Array(nextCapacity * INSTANCE_FLOATS);
      this._capacity = nextCapacity;
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[WebGPUInstanceBufferManager.beginFrame] Failed to create WebGPU instance buffer: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: undefined
    };
  }

  public appendDrawItems(params: {
    drawItems: WebGPUDrawItem[];
    start: number;
    count: number;
    view: View;
    meshManager: WebGPUMeshManager;
  }): number {
    const firstInstance = this._instanceCount;
    const target = this._data;
    let targetOffset = firstInstance * INSTANCE_FLOATS;
    const end = params.start + params.count;

    for (let i = params.start; i < end; i++) {
      params.meshManager.writeInstanceData(params.drawItems[i], params.view, target, targetOffset);
      targetOffset += INSTANCE_FLOATS;
    }

    this._instanceCount += params.count;
    return firstInstance;
  }

  public upload(): void {
    if (!this._buffer || this._instanceCount === 0) {
      return;
    }
    this._renderContext.device.queue.writeBuffer(
      this._buffer,
      0,
      this._data,
      0,
      this._instanceCount * INSTANCE_FLOATS
    );
  }

  public destroy(): void {
    try {
      this._buffer?.destroy?.();
    } catch {
      // Ignore buffer destruction failures during teardown.
    }
    this._buffer = null;
    this._data = new Float32Array(0);
    this._capacity = 0;
    this._instanceCount = 0;
  }
}
