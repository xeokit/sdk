/**
 * Memory summary for one packed WebGPU triangle buffer page.
 */
export interface WebGPUPackedTrianglePageMemoryStats {
  key: string;
  indexFormat: "uint16" | "uint32";
  segmentCount: number;
  vertexCapacity: number;
  usedVertices: number;
  indexCapacity: number;
  usedIndices: number;
  edgeIndexCapacity: number;
  usedEdgeIndices: number;
  positionDecodeCapacity: number;
  usedPositionDecodes: number;
  bytes: number;
  usedBytes: number;
  vertexBytes: number;
  vertexMetadataBytes: number;
  indexBytes: number;
  edgeIndexBytes: number;
  positionDecodeBytes: number;
  usedVertexBytes: number;
  usedVertexMetadataBytes: number;
  usedIndexBytes: number;
  usedEdgeIndexBytes: number;
  usedPositionDecodeBytes: number;
}

/**
 * Compact WebGPU memory summary for renderer diagnostics.
 */
export interface WebGPUMemoryStats {
  totalBytes: number;
  packedTrianglePages: number;
  packedTriangleSegments: number;
  packedTriangleBytes: number;
  packedTriangleVertexBytes: number;
  packedTriangleVertexMetadataBytes: number;
  packedTriangleIndexBytes: number;
  packedTriangleEdgeIndexBytes: number;
  packedTrianglePositionDecodeBytes: number;
  packedTriangleUsedVertexBytes: number;
  packedTriangleUsedVertexMetadataBytes: number;
  packedTriangleUsedIndexBytes: number;
  packedTriangleUsedEdgeIndexBytes: number;
  packedTriangleUsedPositionDecodeBytes: number;
  packedTrianglePageDetails: WebGPUPackedTrianglePageMemoryStats[];
  instanceBufferBytes: number;
  instanceBufferCapacity: number;
  instanceBufferFrames: number;
  rtcTileBufferBytes: number;
  rtcTileCapacity: number;
  rtcTiles: number;
  segmentsByLifecycle: {[lifecycle: string]: number};
  segmentsByMemoryPolicy: {[memoryPolicy: string]: number};
}
