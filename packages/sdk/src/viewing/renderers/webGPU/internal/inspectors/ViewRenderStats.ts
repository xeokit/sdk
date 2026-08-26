import type {RenderBinStats} from "./RenderBinStats";
import type {TimeMs} from "./TimeMs";
import type {CommandEncoderStats} from "./CommandEncoderStats";
import type {InstanceBufferUploadStats, TriangleSegmentBuildTelemetry} from "../gpuMemoryManager";

/**
 * Log entry for one rendered View frame.
 *
 * @internal
 */
export interface ViewRenderStats {
  viewId: string;
  canvasSize: [number, number];
  renderReason: string;
  renderBins: RenderBinStats[];
  timeMs?: TimeMs;
  numDrawCalls: number;
  numPrims: number;
  numInstances: number;
  numBatches: number;
  numSegments: number;
  numBuiltSegments: number;
  numPendingSegments: number;
  segmentBuildTelemetry: TriangleSegmentBuildTelemetry;
  numCullCandidates: number;
  numRenderedMeshes: number;
  numFrustumCulledMeshes: number;
  numProjectedSizeCulledMeshes: number;
  numRTCTiles: number;
  numRTCTileMatrixUploads: number;
  numMeshesWithRTCTile: number;
  numMeshesUsingRTCFallback: number;
  numCullSegmentCandidates: number;
  numFrustumCulledSegments: number;
  numFullyDrawnSegments: number;
  numPartiallyRefinedSegments: number;
  numTemporaryIndexBuffers: number;
  instanceUpload: InstanceBufferUploadStats;
  commandState: CommandEncoderStats;
  cpuTime: {
    frameMs: number;
    prepareMs: number;
    binningMs: number;
    batchingMs: number;
    drawBatchMs: number;
    uploadMs: number;
    commandEncodingMs: number;
    submitMs: number;
  };
  gpuTime: {
    available: boolean;
    pending: boolean;
    passes: {[passName: string]: number};
  };
}
