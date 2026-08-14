import type {SDKResult} from "../../../../../../base/core";
import {SDKErrorType} from "../../../../../../base/core";
import type {
  WebGPUBindGroupLike,
  WebGPURenderPassEncoderLike
} from "../../../../core";
import {RENDER_PASSES, type WebGPURenderPassValue} from "../../../RENDER_PASSES";
import type {CommandEncoderStatsSink} from "../../../inspectors";
import {CommandStateTracker} from "../../CommandStateTracker";
import type {InstancedDrawBatch} from "../../InstancedDrawBatch";
import type {PackedMeshBatch} from "../../PackedMeshBatch";

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
  passEncoder: WebGPURenderPassEncoderLike;
  batches: InstancedDrawBatch[];
  renderPass: WebGPURenderPassValue;
  validateLabel: string;
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

  for (const batch of submissionOrder.batches) {
    const packedBatch = batch.packedBatch;
    commandStateTracker.setVertexBuffer(0, packedBatch.vertexBuffer, packedBatch.vertexBufferOffset ?? 0);
    commandStateTracker.setVertexBuffer(1, packedBatch.vertexMetadataBuffer, packedBatch.vertexMetadataBufferOffset ?? 0);
    commandStateTracker.setBindGroup(2, packedBatch.positionDecodeBindGroup);
    commandStateTracker.setIndexBuffer(packedBatch.indexBuffer, packedBatch.indexFormat, packedBatch.indexBufferOffset ?? 0);
    params.bindBeforeDraw?.(packedBatch);
    commandStateTracker.drawIndexed(packedBatch.indexCount, 1, packedBatch.firstIndex ?? 0, 0, 0);
  }

  return {
    ok: true,
    value: undefined
  };
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
