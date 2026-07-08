import {SDKErrorType, type SDKResult} from "../../../base/core";
import type {View} from "../../viewer";
import type {WebGPUBindGroupLayoutLike, WebGPUBindGroupLike, WebGPUBufferLike} from "../core";
import {GPU_BUFFER_USAGE, INSTANCE_BYTES, INSTANCE_FLOATS} from "./constants";
import type {WebGPUDrawItem} from "./types";
import {WebGPUMeshManager} from "./WebGPUMeshManager";
import {WebGPURenderContext} from "./WebGPURenderContext";

export interface WebGPUInstanceBufferFrame {
  buffer: WebGPUBufferLike | null;
  bindGroup: WebGPUBindGroupLike | null;
  bindGroupLayout: WebGPUBindGroupLayoutLike | null;
  data: Float32Array;
  capacity: number;
  instanceCount: number;
}

/**
 * Owns the per-frame instance stream used by batched mesh draws.
 *
 * @internal
 */
export class WebGPUInstanceBufferManager {

  private readonly _renderContext: WebGPURenderContext;
  private readonly _frames: {[frameId: string]: WebGPUInstanceBufferFrame} = {};
  private _activeFrame: WebGPUInstanceBufferFrame | null = null;

  constructor(renderContext: WebGPURenderContext) {
    this._renderContext = renderContext;
  }

  public get buffer(): WebGPUBufferLike | null {
    return this._activeFrame?.buffer ?? null;
  }

  public beginFrame(instanceCount: number, frameId = "default"): SDKResult<WebGPUInstanceBufferFrame> {
    let frame = this._frames[frameId];
    if (!frame) {
      frame = {
        buffer: null,
        bindGroup: null,
        bindGroupLayout: null,
        data: new Float32Array(0),
        capacity: 0,
        instanceCount: 0
      };
      this._frames[frameId] = frame;
    }
    this._activeFrame = frame;
    frame.instanceCount = 0;

    if (instanceCount <= frame.capacity) {
      return {
        ok: true,
        value: frame
      };
    }

    let nextCapacity = Math.max(1, frame.capacity);
    while (nextCapacity < instanceCount) {
      nextCapacity *= 2;
    }

    try {
      frame.buffer?.destroy?.();
      frame.bindGroup = null;
      frame.bindGroupLayout = null;
      frame.buffer = this._renderContext.device.createBuffer({
        label: "xeokit-webgpu-instance-buffer",
        size: nextCapacity * INSTANCE_BYTES,
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
      });
      frame.data = new Float32Array(nextCapacity * INSTANCE_FLOATS);
      frame.capacity = nextCapacity;
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[WebGPUInstanceBufferManager.beginFrame] Failed to create WebGPU instance buffer: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: frame
    };
  }

  public getBindGroup(
    frame: WebGPUInstanceBufferFrame,
    bindGroupLayout: WebGPUBindGroupLayoutLike
  ): SDKResult<WebGPUBindGroupLike> {
    if (frame.bindGroup && frame.bindGroupLayout === bindGroupLayout) {
      return {
        ok: true,
        value: frame.bindGroup
      };
    }
    if (!frame.buffer) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[WebGPUInstanceBufferManager.getBindGroup] Instance buffer was not initialized."
      };
    }

    try {
      frame.bindGroup = this._renderContext.device.createBindGroup({
        label: "xeokit-webgpu-instance-bind-group",
        layout: bindGroupLayout,
        entries: [{
          binding: 0,
          resource: {
            buffer: frame.buffer
          }
        }]
      });
      frame.bindGroupLayout = bindGroupLayout;
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[WebGPUInstanceBufferManager.getBindGroup] Failed to create WebGPU instance bind group: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: frame.bindGroup
    };
  }

  public appendDrawItems(params: {
    frame?: WebGPUInstanceBufferFrame;
    drawItems: WebGPUDrawItem[];
    start: number;
    count: number;
    view: View;
    meshManager: WebGPUMeshManager;
  }): number {
    const frame = params.frame ?? this._activeFrame;
    if (!frame) {
      throw new Error("[WebGPUInstanceBufferManager.appendDrawItems] No active instance frame.");
    }
    const firstInstance = frame.instanceCount;
    const target = frame.data;
    let targetOffset = firstInstance * INSTANCE_FLOATS;
    const end = params.start + params.count;

    for (let i = params.start; i < end; i++) {
      params.meshManager.writeInstanceData(params.drawItems[i], params.view, target, targetOffset);
      targetOffset += INSTANCE_FLOATS;
    }

    frame.instanceCount += params.count;
    return firstInstance;
  }

  public upload(frame: WebGPUInstanceBufferFrame | null = this._activeFrame): void {
    if (!frame?.buffer || frame.instanceCount === 0) {
      return;
    }
    this._renderContext.device.queue.writeBuffer(
      frame.buffer,
      0,
      frame.data,
      0,
      frame.instanceCount * INSTANCE_FLOATS
    );
  }

  public destroyFrame(frameId: string): void {
    const frame = this._frames[frameId];
    if (!frame) {
      return;
    }
    try {
      frame.buffer?.destroy?.();
    } catch {
      // Ignore buffer destruction failures during teardown.
    }
    frame.bindGroup = null;
    frame.bindGroupLayout = null;
    delete this._frames[frameId];
    if (this._activeFrame === frame) {
      this._activeFrame = null;
    }
  }

  public destroy(): void {
    for (const frameId of Object.keys(this._frames)) {
      this.destroyFrame(frameId);
    }
    this._activeFrame = null;
  }
}
