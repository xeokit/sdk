import type {SDKResult} from "../../../../../../base/core";
import {SDKErrorType} from "../../../../../../base/core";
import type {
  WebGPUBufferLike,
  WebGPUDeviceLike,
  WebGPURenderPassEncoderLike
} from "../../../../core";
import {GPU_BUFFER_USAGE} from "../../../constants";
import {RENDER_PASSES, type WebGPURenderPassValue} from "../../../RENDER_PASSES";
import type {CommandEncoderStatsSink} from "../../../inspectors";
import {CommandStateTracker} from "../../CommandStateTracker";
import type {InstancedDrawBatch} from "../../InstancedDrawBatch";
import type {PackedMeshBatch} from "../../PackedMeshBatch";

const MULTI_DRAW_INDIRECT_FEATURE = "chromium-experimental-multi-draw-indirect";
const INDIRECT_DRAW_INDEXED_UINT32S = 5;
const PACKED_VERTEX_STRIDE_BYTES = 8;
const MIN_INDIRECT_BUFFER_BYTES = 256;

const indirectBufferCache = new WeakMap<WebGPUDeviceLike, {
  buffer: WebGPUBufferLike;
  byteLength: number;
}>();

/**
 * Encodes packed triangle batch draws while avoiding redundant WebGPU state binds.
 *
 * Non-transparent passes are grouped by packed buffer page, then by render
 * state, so batches sharing vertex buffers, metadata buffers, decode tables
 * and future material/style state are adjacent. Transparent passes keep caller
 * order to preserve depth sorting, while still skipping repeated binds when
 * adjacent batches share state.
 *
 * @internal
 */
export function encodePackedTriangleBatches(params: {
  device: WebGPUDeviceLike;
  passEncoder: WebGPURenderPassEncoderLike;
  batches: InstancedDrawBatch[];
  renderPass: WebGPURenderPassValue;
  validateLabel: string;
  bindPositionDecode?: boolean;
  bindBeforeDraw?: (packedBatch: PackedMeshBatch) => void;
  commandStats?: CommandEncoderStatsSink;
  commandStateTracker?: CommandStateTracker;
}): SDKResult<void> {
  const {passEncoder} = params;
  if (
    !passEncoder.setVertexBuffer ||
    !passEncoder.setIndexBuffer ||
    !passEncoder.setBindGroup ||
    !passEncoder.drawIndexed
  ) {
    return {
      ok: false,
      type: SDKErrorType.InitializationFailed,
      error: `[${params.validateLabel}] WebGPU render pass encoder does not expose indexed drawing methods.`
    };
  }

  const commandStateTracker = params.commandStateTracker ?? new CommandStateTracker({
    passEncoder,
    commandStats: params.commandStats
  });

  const submissionOrder = getSubmissionOrder(params.batches, params.renderPass);
  params.commandStats?.submissionGroupsSubmitted?.(submissionOrder.groups);

  const canUseMultiDraw =
    params.renderPass !== RENDER_PASSES.TRANSPARENT &&
    params.bindPositionDecode !== false &&
    !params.bindBeforeDraw &&
    params.device.features?.has?.(MULTI_DRAW_INDIRECT_FEATURE) === true &&
    typeof passEncoder.multiDrawIndexedIndirect === "function";

  for (let i = 0, len = submissionOrder.batches.length; i < len;) {
    if (canUseMultiDraw) {
      const groupLength = getMultiDrawGroupLength(submissionOrder.batches, i);
      if (groupLength > 1) {
        const firstPackedBatch = submissionOrder.batches[i].packedBatch;
        commandStateTracker.setVertexBuffer(0, firstPackedBatch.vertexBuffer, 0);
        commandStateTracker.setVertexBuffer(1, firstPackedBatch.vertexMetadataBuffer, 0);
        commandStateTracker.setBindGroup(2, firstPackedBatch.positionDecodeBindGroup, true);
        commandStateTracker.setIndexBuffer(firstPackedBatch.indexBuffer, firstPackedBatch.indexFormat, 0);

        const commands = createIndexedIndirectCommands(submissionOrder.batches, i, groupLength);
        const indirectBuffer = getIndirectBuffer(params.device, commands.byteLength);
        params.device.queue.writeBuffer(indirectBuffer, 0, commands);
        commandStateTracker.multiDrawIndexedIndirect(indirectBuffer, 0, groupLength);
        i += groupLength;
        continue;
      }
    }

    const batch = submissionOrder.batches[i];
    const packedBatch = batch.packedBatch;
    const vertexBufferOffset = packedBatch.indicesPageLocal ? 0 : (packedBatch.vertexBufferOffset ?? 0);
    const vertexMetadataBufferOffset = packedBatch.indicesPageLocal ? 0 : (packedBatch.vertexMetadataBufferOffset ?? 0);
    commandStateTracker.setVertexBuffer(0, packedBatch.vertexBuffer, vertexBufferOffset);
    commandStateTracker.setVertexBuffer(1, packedBatch.vertexMetadataBuffer, vertexMetadataBufferOffset);
    if (params.bindPositionDecode !== false) {
      commandStateTracker.setBindGroup(2, packedBatch.positionDecodeBindGroup, true);
    }
    commandStateTracker.setIndexBuffer(packedBatch.indexBuffer, packedBatch.indexFormat, packedBatch.indexBufferOffset ?? 0);
    params.bindBeforeDraw?.(packedBatch);
    commandStateTracker.drawIndexed(packedBatch.indexCount, 1, packedBatch.firstIndex ?? 0, 0, 0);
    i++;
  }

  return {
    ok: true,
    value: undefined
  };
}

function getMultiDrawGroupLength(batches: InstancedDrawBatch[], startIndex: number): number {
  const first = batches[startIndex]?.packedBatch;
  if (!first || !canMultiDrawBatch(first)) {
    return 0;
  }
  let groupLength = 1;
  for (let i = startIndex + 1, len = batches.length; i < len; i++) {
    const next = batches[i].packedBatch;
    if (!canMultiDrawBatch(next) || !hasSameMultiDrawState(first, next)) {
      break;
    }
    groupLength++;
  }
  return groupLength;
}

function canMultiDrawBatch(batch: PackedMeshBatch): boolean {
  if (batch.temporaryIndexBuffer || batch.indexCount <= 0 || !batch.indicesPageLocal) {
    return false;
  }
  const vertexBufferOffset = batch.vertexBufferOffset ?? 0;
  const vertexMetadataBufferOffset = batch.vertexMetadataBufferOffset ?? 0;
  if (
    vertexBufferOffset % PACKED_VERTEX_STRIDE_BYTES !== 0 ||
    vertexMetadataBufferOffset % PACKED_VERTEX_STRIDE_BYTES !== 0
  ) {
    return false;
  }
  const indexByteLength = getIndexByteLength(batch.indexFormat);
  const indexBufferOffset = batch.indexBufferOffset ?? 0;
  return indexBufferOffset % indexByteLength === 0;
}

function hasSameMultiDrawState(first: PackedMeshBatch, next: PackedMeshBatch): boolean {
  return first.vertexBuffer === next.vertexBuffer &&
    first.uvBuffer === next.uvBuffer &&
    first.colorBindGroup === next.colorBindGroup &&
    first.vertexMetadataBuffer === next.vertexMetadataBuffer &&
    first.positionDecodeBindGroup === next.positionDecodeBindGroup &&
    first.indexBuffer === next.indexBuffer &&
    first.indexFormat === next.indexFormat &&
    first.bufferPageKey === next.bufferPageKey &&
    first.renderStateKey === next.renderStateKey &&
    first.topology === next.topology;
}

function createIndexedIndirectCommands(
  batches: InstancedDrawBatch[],
  startIndex: number,
  groupLength: number
): Uint32Array {
  const commands = new Uint32Array(groupLength * INDIRECT_DRAW_INDEXED_UINT32S);
  for (let i = 0; i < groupLength; i++) {
    const batch = batches[startIndex + i].packedBatch;
    const commandOffset = i * INDIRECT_DRAW_INDEXED_UINT32S;
    const indexByteLength = getIndexByteLength(batch.indexFormat);
    commands[commandOffset] = batch.indexCount;
    commands[commandOffset + 1] = 1;
    commands[commandOffset + 2] = ((batch.indexBufferOffset ?? 0) / indexByteLength) + (batch.firstIndex ?? 0);
    commands[commandOffset + 3] = 0;
    commands[commandOffset + 4] = 0;
  }
  return commands;
}

function getIndirectBuffer(device: WebGPUDeviceLike, byteLength: number): WebGPUBufferLike {
  const cached = indirectBufferCache.get(device);
  if (cached && cached.byteLength >= byteLength) {
    return cached.buffer;
  }
  const nextByteLength = getNextPowerOfTwo(Math.max(MIN_INDIRECT_BUFFER_BYTES, byteLength));
  const buffer = device.createBuffer({
    label: "xeokit-webgpu-packed-triangle-multi-draw-indirect",
    size: nextByteLength,
    usage: GPU_BUFFER_USAGE.INDIRECT | GPU_BUFFER_USAGE.COPY_DST
  });
  indirectBufferCache.set(device, {
    buffer,
    byteLength: nextByteLength
  });
  return buffer;
}

function getIndexByteLength(indexFormat: "uint16" | "uint32"): number {
  return indexFormat === "uint32" ? 4 : 2;
}

function getNextPowerOfTwo(value: number): number {
  let next = 1;
  while (next < value) {
    next <<= 1;
  }
  return next;
}

function getSubmissionOrder(
  batches: InstancedDrawBatch[],
  renderPass: WebGPURenderPassValue
): {
  batches: InstancedDrawBatch[];
  groups: {
    submissionGroups: number;
    bufferPageGroups: number;
    renderStateGroups: number;
  };
} {
  if (renderPass === RENDER_PASSES.TRANSPARENT || batches.length < 2) {
    return {
      batches,
      groups: countSubmissionGroupsInOrder(batches)
    };
  }

  const pageGroups = new Map<string, Map<string, InstancedDrawBatch[]>>();
  for (const batch of batches) {
    const pageKey = getOpaqueBufferPageGroupKey(batch.packedBatch);
    const stateKey = getOpaqueRenderStateGroupKey(batch.packedBatch);
    let stateGroups = pageGroups.get(pageKey);
    if (!stateGroups) {
      stateGroups = new Map<string, InstancedDrawBatch[]>();
      pageGroups.set(pageKey, stateGroups);
    }
    let group = stateGroups.get(stateKey);
    if (!group) {
      group = [];
      stateGroups.set(stateKey, group);
    }
    group.push(batch);
  }

  const ordered: InstancedDrawBatch[] = [];
  let renderStateGroups = 0;
  for (const stateGroups of pageGroups.values()) {
    renderStateGroups += stateGroups.size;
    for (const group of stateGroups.values()) {
      ordered.push(...group);
    }
  }

  return {
    batches: ordered,
    groups: {
      submissionGroups: renderStateGroups,
      bufferPageGroups: pageGroups.size,
      renderStateGroups
    }
  };
}

function getOpaqueBufferPageGroupKey(batch: PackedMeshBatch): string {
  return `${batch.topology ?? "triangles"}|${batch.bufferPageKey ?? batch.segmentKey}`;
}

function getOpaqueRenderStateGroupKey(batch: PackedMeshBatch): string {
  return batch.renderStateKey ?? "default";
}

function countSubmissionGroupsInOrder(batches: InstancedDrawBatch[]): {
  submissionGroups: number;
  bufferPageGroups: number;
  renderStateGroups: number;
} {
  if (batches.length === 0) {
    return {
      submissionGroups: 0,
      bufferPageGroups: 0,
      renderStateGroups: 0
    };
  }

  let bufferPageGroups = 0;
  let renderStateGroups = 0;
  let lastPageKey = "";
  let lastStateKey = "";
  for (let i = 0, len = batches.length; i < len; i++) {
    const batch = batches[i].packedBatch;
    const pageKey = getOpaqueBufferPageGroupKey(batch);
    const stateKey = getOpaqueRenderStateGroupKey(batch);
    if (i === 0 || pageKey !== lastPageKey) {
      bufferPageGroups++;
      lastPageKey = pageKey;
      lastStateKey = "";
    }
    if (i === 0 || stateKey !== lastStateKey) {
      renderStateGroups++;
      lastStateKey = stateKey;
    }
  }
  return {
    submissionGroups: renderStateGroups,
    bufferPageGroups,
    renderStateGroups
  };
}
