/**
 * Memory summary for one packed WebGPU triangle buffer page.
 */
export interface WebGPUPackedTrianglePageMemoryStats {
  /**
   * Stable page key used by renderer diagnostics.
   */
  key: string;

  /**
   * Index format used by the page.
   */
  indexFormat: "uint16" | "uint32";

  /**
   * Number of packed geometry segments stored in the page.
   */
  segmentCount: number;

  /**
   * Allocated vertex capacity for the page.
   */
  vertexCapacity: number;

  /**
   * Number of vertices currently used by packed segments in the page.
   */
  usedVertices: number;

  /**
   * Allocated triangle index capacity for the page.
   */
  indexCapacity: number;

  /**
   * Number of triangle indices currently used by packed segments in the page.
   */
  usedIndices: number;

  /**
   * Allocated edge index capacity for the page.
   */
  edgeIndexCapacity: number;

  /**
   * Number of edge indices currently used by packed segments in the page.
   */
  usedEdgeIndices: number;

  /**
   * Allocated position-decode record capacity for the page.
   */
  positionDecodeCapacity: number;

  /**
   * Number of position-decode records currently used by packed segments in the page.
   */
  usedPositionDecodes: number;

  /**
   * Total allocated bytes for all GPU buffers owned by the page.
   */
  bytes: number;

  /**
   * Bytes currently occupied by packed segment data in the page.
   */
  usedBytes: number;

  /**
   * Allocated bytes for packed vertex positions.
   */
  vertexBytes: number;

  /**
   * Allocated bytes for packed per-vertex metadata.
   */
  vertexMetadataBytes: number;

  /**
   * Allocated bytes for packed triangle indices.
   */
  indexBytes: number;

  /**
   * Allocated bytes for packed edge indices.
   */
  edgeIndexBytes: number;

  /**
   * Allocated bytes for position-decode records.
   */
  positionDecodeBytes: number;

  /**
   * Bytes currently used by packed vertex positions.
   */
  usedVertexBytes: number;

  /**
   * Bytes currently used by packed per-vertex metadata.
   */
  usedVertexMetadataBytes: number;

  /**
   * Bytes currently used by packed triangle indices.
   */
  usedIndexBytes: number;

  /**
   * Bytes currently used by packed edge indices.
   */
  usedEdgeIndexBytes: number;

  /**
   * Bytes currently used by position-decode records.
   */
  usedPositionDecodeBytes: number;
}

/**
 * Compact WebGPU memory summary for renderer diagnostics.
 */
export interface WebGPUMemoryStats {
  /**
   * Total allocated WebGPU buffer bytes tracked by the renderer.
   */
  totalBytes: number;

  /**
   * Number of packed triangle buffer pages.
   */
  packedTrianglePages: number;

  /**
   * Number of packed triangle-family segments stored across all pages.
   */
  packedTriangleSegments: number;

  /**
   * Total allocated bytes for packed triangle-family pages.
   */
  packedTriangleBytes: number;

  /**
   * Allocated bytes for packed triangle vertex positions.
   */
  packedTriangleVertexBytes: number;

  /**
   * Allocated bytes for packed triangle per-vertex metadata.
   */
  packedTriangleVertexMetadataBytes: number;

  /**
   * Allocated bytes for packed triangle indices.
   */
  packedTriangleIndexBytes: number;

  /**
   * Allocated bytes for packed edge indices.
   */
  packedTriangleEdgeIndexBytes: number;

  /**
   * Allocated bytes for packed position-decode records.
   */
  packedTrianglePositionDecodeBytes: number;

  /**
   * Bytes currently occupied by packed triangle vertex positions.
   */
  packedTriangleUsedVertexBytes: number;

  /**
   * Bytes currently occupied by packed triangle per-vertex metadata.
   */
  packedTriangleUsedVertexMetadataBytes: number;

  /**
   * Bytes currently occupied by packed triangle indices.
   */
  packedTriangleUsedIndexBytes: number;

  /**
   * Bytes currently occupied by packed edge indices.
   */
  packedTriangleUsedEdgeIndexBytes: number;

  /**
   * Bytes currently occupied by packed position-decode records.
   */
  packedTriangleUsedPositionDecodeBytes: number;

  /**
   * Per-page packed triangle memory details.
   */
  packedTrianglePageDetails: WebGPUPackedTrianglePageMemoryStats[];

  /**
   * Allocated bytes for per-view instance buffers.
   */
  instanceBufferBytes: number;

  /**
   * Allocated instance record capacity across per-view instance buffers.
   */
  instanceBufferCapacity: number;

  /**
   * Number of per-view instance-buffer frame slots.
   */
  instanceBufferFrames: number;

  /**
   * Allocated bytes for RTC tile matrix buffers.
   */
  rtcTileBufferBytes: number;

  /**
   * Allocated RTC tile capacity.
   */
  rtcTileCapacity: number;

  /**
   * Number of RTC tiles currently tracked by the renderer.
   */
  rtcTiles: number;

  /**
   * Packed segment counts grouped by scene-model lifecycle.
   */
  segmentsByLifecycle: {[lifecycle: string]: number};

  /**
   * Packed segment counts grouped by scene-model memory policy.
   */
  segmentsByMemoryPolicy: {[memoryPolicy: string]: number};
}
