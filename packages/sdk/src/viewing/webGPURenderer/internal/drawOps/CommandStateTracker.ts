import type {
  WebGPUBindGroupLike,
  WebGPUBufferLike,
  WebGPURenderPassEncoderLike,
  WebGPURenderPipelineLike
} from "../../core";
import type {CommandEncoderStatsSink} from "../inspectors";
import type {PipelineState} from "./PipelineState";

/**
 * Tracks WebGPU render-pass command state and skips redundant state binds.
 *
 * Mirrors the WebGL renderer's draw-state discipline in a WebGPU-specific
 * facade, keeping technique code focused on pass intent instead of cache
 * bookkeeping.
 *
 * @internal
 */
export class CommandStateTracker {

  private readonly _passEncoder: WebGPURenderPassEncoderLike;
  private readonly _commandStats?: CommandEncoderStatsSink;
  private _activePipeline: WebGPURenderPipelineLike | null = null;
  private _activeBindGroupLayoutSignature: readonly string[] = [];
  private _activeBindGroups: {[slot: number]: WebGPUBindGroupLike | undefined} = {};
  private _activeVertexBuffers: {[slot: number]: {buffer: WebGPUBufferLike; offset: number} | undefined} = {};
  private _activeIndexBuffer: WebGPUBufferLike | null = null;
  private _activeIndexFormat: "uint16" | "uint32" | null = null;
  private _activeIndexOffset = 0;

  constructor(params: {
    passEncoder: WebGPURenderPassEncoderLike;
    commandStats?: CommandEncoderStatsSink;
  }) {
    this._passEncoder = params.passEncoder;
    this._commandStats = params.commandStats;
  }

  public get passEncoder(): WebGPURenderPassEncoderLike {
    return this._passEncoder;
  }

  public setPipeline(pipelineState: PipelineState): void {
    this._invalidateIncompatibleBindGroups(pipelineState.bindGroupLayoutSignature);
    if (pipelineState.renderPipeline === this._activePipeline) {
      return;
    }
    this._passEncoder.setPipeline?.(pipelineState.renderPipeline);
    this._commandStats?.pipelineBound();
    this._activePipeline = pipelineState.renderPipeline;
  }

  public setBindGroup(slot: number, bindGroup: WebGPUBindGroupLike): void {
    if (this._activeBindGroups[slot] === bindGroup) {
      return;
    }
    this._passEncoder.setBindGroup?.(slot, bindGroup);
    this._commandStats?.bindGroupBound(slot);
    this._activeBindGroups[slot] = bindGroup;
  }

  public setVertexBuffer(slot: number, buffer: WebGPUBufferLike, offset = 0): void {
    const active = this._activeVertexBuffers[slot];
    if (active?.buffer === buffer && active.offset === offset) {
      return;
    }
    if (offset === 0) {
      this._passEncoder.setVertexBuffer?.(slot, buffer);
    } else {
      this._passEncoder.setVertexBuffer?.(slot, buffer, offset);
    }
    this._commandStats?.vertexBufferBound(slot);
    this._activeVertexBuffers[slot] = {buffer, offset};
  }

  public setIndexBuffer(buffer: WebGPUBufferLike, indexFormat: "uint16" | "uint32", offset = 0): void {
    if (this._activeIndexBuffer === buffer && this._activeIndexFormat === indexFormat && this._activeIndexOffset === offset) {
      return;
    }
    if (offset === 0) {
      this._passEncoder.setIndexBuffer?.(buffer, indexFormat);
    } else {
      this._passEncoder.setIndexBuffer?.(buffer, indexFormat, offset);
    }
    this._commandStats?.indexBufferBound();
    this._activeIndexBuffer = buffer;
    this._activeIndexFormat = indexFormat;
    this._activeIndexOffset = offset;
  }

  public drawIndexed(
    indexCount: number,
    instanceCount?: number,
    firstIndex?: number,
    baseVertex?: number,
    firstInstance?: number
  ): void {
    this._passEncoder.drawIndexed?.(indexCount, instanceCount, firstIndex, baseVertex, firstInstance);
  }

  public drawIndexedIndirect(indirectBuffer: WebGPUBufferLike, indirectOffset: number): void {
    this._passEncoder.drawIndexedIndirect?.(indirectBuffer, indirectOffset);
  }

  public multiDrawIndexedIndirect(indirectBuffer: WebGPUBufferLike, indirectOffset: number, drawCount: number): void {
    this._passEncoder.multiDrawIndexedIndirect?.(indirectBuffer, indirectOffset, drawCount);
  }

  public draw(vertexCount: number, instanceCount?: number, firstVertex?: number, firstInstance?: number): void {
    this._passEncoder.draw?.(vertexCount, instanceCount, firstVertex, firstInstance);
  }

  private _invalidateIncompatibleBindGroups(nextSignature: readonly string[]): void {
    const currentSignature = this._activeBindGroupLayoutSignature;
    if (currentSignature === nextSignature) {
      return;
    }
    const nextBindGroups: {[slot: number]: WebGPUBindGroupLike | undefined} = {};
    for (const [slotText, bindGroup] of Object.entries(this._activeBindGroups)) {
      const slot = Number(slotText);
      if (currentSignature[slot] !== undefined && currentSignature[slot] === nextSignature[slot]) {
        nextBindGroups[slot] = bindGroup;
      }
    }
    this._activeBindGroups = nextBindGroups;
    this._activeBindGroupLayoutSignature = nextSignature;
  }
}
