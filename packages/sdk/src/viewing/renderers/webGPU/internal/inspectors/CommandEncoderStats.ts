/**
 * Counts WebGPU command encoder state changes for one frame or render bin.
 *
 * @internal
 */
export interface CommandEncoderStats {
  numPipelineBinds: number;
  numVertexBufferBinds: number;
  numIndexBufferBinds: number;
  numBindGroupBinds: number;
  numSubmissionGroups: number;
  numBufferPageGroups: number;
  numRenderStateGroups: number;
  bindGroupBindsBySlot: {[slot: string]: number};
}

/**
 * Receives command encoder state-change notifications from draw techniques.
 *
 * @internal
 */
export interface CommandEncoderStatsSink {
  pipelineBound(): void;
  vertexBufferBound(slot: number): void;
  indexBufferBound(): void;
  bindGroupBound(slot: number): void;
  submissionGroupsSubmitted?(groups: {
    submissionGroups: number;
    bufferPageGroups: number;
    renderStateGroups: number;
  }): void;
}

/**
 * Creates an empty command encoder stats object.
 *
 * @internal
 */
export function createCommandEncoderStats(): CommandEncoderStats {
  return {
    numPipelineBinds: 0,
    numVertexBufferBinds: 0,
    numIndexBufferBinds: 0,
    numBindGroupBinds: 0,
    numSubmissionGroups: 0,
    numBufferPageGroups: 0,
    numRenderStateGroups: 0,
    bindGroupBindsBySlot: {}
  };
}
