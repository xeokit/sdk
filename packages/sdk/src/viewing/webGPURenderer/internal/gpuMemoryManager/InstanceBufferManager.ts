import {SDKErrorType, type SDKResult} from "../../../../base/core";
import type {View} from "../../../viewer";
import type {WebGPUBindGroupLayoutLike, WebGPUBindGroupLike, WebGPUBufferLike} from "../../core";
import {GPU_BUFFER_USAGE, INSTANCE_BYTES, INSTANCE_FLOATS} from "../constants";
import type {DrawItem} from "../renderState";
import {MeshManager, type MeshRTCTileResolver} from "../meshManager";
import {RenderContext} from "../RenderContext";

export interface InstanceBufferFrame {
  buffer: WebGPUBufferLike | null;
  bindGroup: WebGPUBindGroupLike | null;
  bindGroupLayout: WebGPUBindGroupLayoutLike | null;
  data: Float32Array;
  capacity: number;
  instanceCount: number;
  bufferVersion: number;
  forceFullUpload: boolean;
  dirtySlotRanges: InstanceSlotRange[];
  copiedByteLength: number;
}

export interface InstanceSlotRange {
  base: number;
  count: number;
}

export interface InstanceBufferMemoryStats {
  frames: number;
  capacity: number;
  bytes: number;
}

export interface InstanceBufferUploadStats {
  writeCount: number;
  byteLength: number;
  rangeCount: number;
  maxRangeSlots: number;
  fullUpload: boolean;
  copiedByteLength: number;
}

/**
 * Owns the per-frame instance stream used by batched mesh draws.
 *
 * @internal
 */
export class InstanceBufferManager {

  private readonly _renderContext: RenderContext;
  private readonly _frames: {[frameId: string]: InstanceBufferFrame} = {};
  private _activeFrame: InstanceBufferFrame | null = null;

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
  }

  public get buffer(): WebGPUBufferLike | null {
    return this._activeFrame?.buffer ?? null;
  }

  public beginFrame(instanceCount: number, frameId = "default"): SDKResult<InstanceBufferFrame> {
    let frame = this._frames[frameId];
    if (!frame) {
      frame = {
        buffer: null,
        bindGroup: null,
        bindGroupLayout: null,
        data: new Float32Array(0),
        capacity: 0,
        instanceCount: 0,
        bufferVersion: 0,
        forceFullUpload: false,
        dirtySlotRanges: [],
        copiedByteLength: 0
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
      const previousBuffer = frame.buffer;
      const previousCapacity = frame.capacity;
      const previousData = frame.data;
      frame.bindGroup = null;
      frame.bindGroupLayout = null;
      frame.buffer = this._renderContext.device.createBuffer({
        label: "xeokit-webgpu-instance-buffer",
        size: nextCapacity * INSTANCE_BYTES,
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
      });
      frame.data = new Float32Array(nextCapacity * INSTANCE_FLOATS);
      const copiedPreviousBuffer = this._copyPreviousBuffer(previousBuffer, frame.buffer, previousCapacity);
      if (copiedPreviousBuffer) {
        frame.data.set(previousData.subarray(0, previousCapacity * INSTANCE_FLOATS));
      }
      previousBuffer?.destroy?.();
      frame.capacity = nextCapacity;
      if (!copiedPreviousBuffer) {
        frame.bufferVersion++;
      }
      frame.forceFullUpload = !copiedPreviousBuffer;
      frame.copiedByteLength = copiedPreviousBuffer ? previousCapacity * INSTANCE_BYTES : 0;
      frame.dirtySlotRanges.length = 0;
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[InstanceBufferManager.beginFrame] Failed to create WebGPU instance buffer: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: frame
    };
  }

  public getBindGroup(
    frame: InstanceBufferFrame,
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
        error: "[InstanceBufferManager.getBindGroup] Instance buffer was not initialized."
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
        error: `[InstanceBufferManager.getBindGroup] Failed to create WebGPU instance bind group: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: frame.bindGroup
    };
  }

  public appendDrawItems(params: {
    frame?: InstanceBufferFrame;
    drawItems: DrawItem[];
    start: number;
    count: number;
    view: View;
    meshManager: MeshManager;
    rtcTileResolver?: MeshRTCTileResolver;
  }): number {
    const frame = params.frame ?? this._activeFrame;
    if (!frame) {
      throw new Error("[InstanceBufferManager.appendDrawItems] No active instance frame.");
    }
    const firstInstance = frame.instanceCount;
    const target = frame.data;
    let targetOffset = firstInstance * INSTANCE_FLOATS;
    const end = params.start + params.count;

    for (let i = params.start; i < end; i++) {
      params.meshManager.writeInstanceData(params.drawItems[i], params.view, target, targetOffset, params.rtcTileResolver);
      targetOffset += INSTANCE_FLOATS;
    }

    frame.instanceCount += params.count;
    return firstInstance;
  }

  public upload(frame: InstanceBufferFrame | null = this._activeFrame): InstanceBufferUploadStats {
    const emptyStats: InstanceBufferUploadStats = {
      writeCount: 0,
      byteLength: 0,
      rangeCount: 0,
      maxRangeSlots: 0,
      fullUpload: false,
      copiedByteLength: frame?.copiedByteLength ?? 0
    };
    if (!frame?.buffer || frame.instanceCount === 0) {
      return emptyStats;
    }
    if (frame.forceFullUpload) {
      const byteLength = frame.instanceCount * INSTANCE_BYTES;
      this._renderContext.device.queue.writeBuffer(
        frame.buffer,
        0,
        frame.data,
        0,
        frame.instanceCount * INSTANCE_FLOATS
      );
      frame.forceFullUpload = false;
      frame.dirtySlotRanges.length = 0;
      const stats = {
        writeCount: 1,
        byteLength,
        rangeCount: 1,
        maxRangeSlots: frame.instanceCount,
        fullUpload: true,
        copiedByteLength: frame.copiedByteLength
      };
      frame.copiedByteLength = 0;
      return stats;
    }

    if (frame.dirtySlotRanges.length === 0) {
      const stats = {
        ...emptyStats,
        copiedByteLength: frame.copiedByteLength
      };
      frame.copiedByteLength = 0;
      return stats;
    }
    this._mergeDirtySlotRanges(frame.dirtySlotRanges);
    let byteLength = 0;
    let maxRangeSlots = 0;
    for (let i = 0, len = frame.dirtySlotRanges.length; i < len; i++) {
      const range = frame.dirtySlotRanges[i];
      byteLength += range.count * INSTANCE_BYTES;
      maxRangeSlots = Math.max(maxRangeSlots, range.count);
      this._renderContext.device.queue.writeBuffer(
        frame.buffer,
        range.base * INSTANCE_BYTES,
        frame.data,
        range.base * INSTANCE_FLOATS,
        range.count * INSTANCE_FLOATS
      );
    }
    const stats = {
      writeCount: frame.dirtySlotRanges.length,
      byteLength,
      rangeCount: frame.dirtySlotRanges.length,
      maxRangeSlots,
      fullUpload: false,
      copiedByteLength: frame.copiedByteLength
    };
    frame.dirtySlotRanges.length = 0;
    frame.copiedByteLength = 0;
    return stats;
  }

  public static markDirtySlotRange(frame: InstanceBufferFrame, base: number, count: number): void {
    if (count <= 0) {
      return;
    }
    frame.dirtySlotRanges.push({base, count});
  }

  private _copyPreviousBuffer(previousBuffer: WebGPUBufferLike | null, nextBuffer: WebGPUBufferLike, previousCapacity: number): boolean {
    const byteLength = previousCapacity * INSTANCE_BYTES;
    if (!previousBuffer || byteLength <= 0) {
      return false;
    }
    const commandEncoder = this._renderContext.device.createCommandEncoder();
    if (!commandEncoder.copyBufferToBuffer) {
      return false;
    }
    commandEncoder.copyBufferToBuffer(previousBuffer, 0, nextBuffer, 0, byteLength);
    this._renderContext.device.queue.submit([commandEncoder.finish()]);
    return true;
  }

  public getMemoryStats(): InstanceBufferMemoryStats {
    let frames = 0;
    let capacity = 0;
    for (const frameId of Object.keys(this._frames)) {
      const frame = this._frames[frameId];
      if (!frame.buffer) {
        continue;
      }
      frames++;
      capacity += frame.capacity;
    }
    return {
      frames,
      capacity,
      bytes: capacity * INSTANCE_BYTES
    };
  }

  private _mergeDirtySlotRanges(ranges: InstanceSlotRange[]): void {
    if (ranges.length < 2) {
      return;
    }
    ranges.sort((a, b) => a.base - b.base);
    let writeIndex = 0;
    for (let readIndex = 1; readIndex < ranges.length; readIndex++) {
      const current = ranges[writeIndex];
      const next = ranges[readIndex];
      const currentEnd = current.base + current.count;
      if (next.base <= currentEnd) {
        current.count = Math.max(current.count, next.base + next.count - current.base);
        continue;
      }
      writeIndex++;
      ranges[writeIndex] = next;
    }
    ranges.length = writeIndex + 1;
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
