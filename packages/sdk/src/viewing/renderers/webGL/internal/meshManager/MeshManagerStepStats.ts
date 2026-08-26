/**
 * Step-level timings + counters populated inside renderer mesh registration
 * when MeshManager step stats are enabled.
 *
 * @internal
 */
export interface MeshManagerStepStats {
  /** Cumulative wall time spent inside `_getMeshBatch`. */
  getMeshBatchMs: number;
  /** Number of `_getMeshBatch` invocations. */
  getMeshBatchCalls: number;
  /** Cumulative scan iterations over compatible batch buckets. */
  batchScanIters: number;
  /** Number of times `_getMeshBatch` had to allocate a new batch. */
  newBatches: number;
  /** Cumulative wall time computing the initial RTC tile placement. */
  meshPlacementMs: number;
  /** Number of initial RTC tile placements computed. */
  meshPlacementCalls: number;
  /** Number of deferred mesh flushes sent through the bulk path. */
  bulkMeshFlushes: number;
  /** Number of meshes processed by deferred bulk flushes. */
  bulkMeshFlushMeshes: number;
  /** Cumulative wall time spent inside `meshBatch.addMesh` (GPU writes). */
  batchAddMeshMs: number;
  /** Number of `meshBatch.addMesh` invocations. */
  batchAddMeshCalls: number;
  /** Cumulative wall time constructing the `RendererMesh`. */
  rendererMeshCtorMs: number;
  /** Number of `RendererMesh` constructions. */
  rendererMeshCtorCalls: number;
  /** Cumulative wall time in `GPUMemoryBatch.addMesh`. */
  gpuAddMeshMs: number;
  /** Number of `GPUMemoryBatch.addMesh` invocations. */
  gpuAddMeshCalls: number;
  /** Cumulative wall time creating shared geometry handles. */
  gpuCreateGeometryHandleMs: number;
  /** Number of shared geometry-handle creations. */
  gpuCreateGeometryHandleCalls: number;
  /** Cumulative wall time writing mesh attribute texture rows. */
  gpuWriteMeshAttributesMs: number;
  /** Cumulative wall time initializing per-view mesh attributes. */
  gpuInitMeshViewAttributesMs: number;
  /** Cumulative wall time writing mesh matrix texture rows. */
  gpuWriteMeshMatrixMs: number;
  /** Cumulative wall time creating storage-specific mesh handles. */
  gpuCreateGeometryMeshHandleMs: number;
  /** Cumulative wall time creating CPU mesh-handle bookkeeping records. */
  gpuCreateMeshRecordMs: number;
  /** Cumulative wall time inside `TriangleGeometryVBOBatch.addMesh`. */
  vboAddMeshMs: number;
  /** Number of VBO mesh additions. */
  vboAddMeshCalls: number;
  /** Number of VBO mesh additions made while a bulk scope was active. */
  vboBulkAddMeshCalls: number;
  /** Number of VBO bulk-add scopes opened. */
  vboBulkScopes: number;
  /** Cumulative wall time baking positions/mesh ids/geometry vertex ids. */
  vboWriteGeometryMs: number;
  /** Number of VBO geometry writes. */
  vboWriteGeometryCalls: number;
  /** Cumulative wall time in the triangle vertex packing loop. */
  vboPackVerticesMs: number;
  /** Cumulative wall time remapping feature-edge indices. */
  vboPackEdgesMs: number;
  /** Cumulative wall time writing VBO color buffers. */
  vboWriteColorsMs: number;
  /** Cumulative wall time writing per-view VBO index slots. */
  vboWriteIndexSlotsMs: number;
  /** Cumulative wall time refreshing VBO draw ranges. */
  vboRefreshRangesMs: number;
  /** Number of VBO draw-range refresh operations. */
  vboRefreshRangesCalls: number;
}

export function createMeshManagerStepStats(): MeshManagerStepStats {
  return {
    getMeshBatchMs: 0,
    getMeshBatchCalls: 0,
    batchScanIters: 0,
    newBatches: 0,
    meshPlacementMs: 0,
    meshPlacementCalls: 0,
    bulkMeshFlushes: 0,
    bulkMeshFlushMeshes: 0,
    batchAddMeshMs: 0,
    batchAddMeshCalls: 0,
    rendererMeshCtorMs: 0,
    rendererMeshCtorCalls: 0,
    gpuAddMeshMs: 0,
    gpuAddMeshCalls: 0,
    gpuCreateGeometryHandleMs: 0,
    gpuCreateGeometryHandleCalls: 0,
    gpuWriteMeshAttributesMs: 0,
    gpuInitMeshViewAttributesMs: 0,
    gpuWriteMeshMatrixMs: 0,
    gpuCreateGeometryMeshHandleMs: 0,
    gpuCreateMeshRecordMs: 0,
    vboAddMeshMs: 0,
    vboAddMeshCalls: 0,
    vboBulkAddMeshCalls: 0,
    vboBulkScopes: 0,
    vboWriteGeometryMs: 0,
    vboWriteGeometryCalls: 0,
    vboPackVerticesMs: 0,
    vboPackEdgesMs: 0,
    vboWriteColorsMs: 0,
    vboWriteIndexSlotsMs: 0,
    vboRefreshRangesMs: 0,
    vboRefreshRangesCalls: 0
  };
}
