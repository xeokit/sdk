import type {View} from "../../../../viewer";
import type {InstancedDrawBatch} from "../drawOps";
import type {RenderStats} from "./RenderStats";
import type {RenderBinStats} from "./RenderBinStats";
import type {ViewRenderStats} from "./ViewRenderStats";
import {createCommandEncoderStats} from "./CommandEncoderStats";
import type {InstanceBufferUploadStats, TriangleSegmentBuildTelemetry} from "../gpuMemoryManager";

const nowMs = (): number => {
  const performanceLike = (globalThis as {performance?: {now?: () => number}}).performance;
  return performanceLike?.now ? performanceLike.now() : Date.now();
};

/**
 * Captures lightweight WebGPU frame and draw-batch statistics.
 *
 * Mirrors the WebGL renderer's RenderInspector role while staying focused on
 * WebGPU's current triangle color path.
 *
 * @internal
 */
export class RenderInspector {

  public enabled = false;

  public readonly renderStats: RenderStats = {
    views: []
  };

  private _currentFrame: ViewRenderStats | null = null;
  private _currentBin: RenderBinStats | null = null;
  private _lastFrameEndByViewId: {[viewId: string]: number} = {};
  private _frameRatesByViewId: {[viewId: string]: number} = {};

  public get active(): boolean {
    return this.enabled;
  }

  public frameStarted(view: View): void {
    if (!this.enabled) {
      return;
    }
    const t = nowMs();
    const viewIndex = (view as {viewIndex?: number}).viewIndex ?? 0;
    const width = Math.max(0, Math.floor(view.boundary?.[2] ?? view.htmlElement?.clientWidth ?? 0));
    const height = Math.max(0, Math.floor(view.boundary?.[3] ?? view.htmlElement?.clientHeight ?? 0));

    this._currentFrame = {
      viewId: view.id,
      canvasSize: [width, height],
      renderReason: "unknown",
      renderBins: [],
      timeMs: {start: t, end: t, duration: 0},
      numDrawCalls: 0,
      numPrims: 0,
      numInstances: 0,
      numBatches: 0,
      numSegments: 0,
      numBuiltSegments: 0,
      numPendingSegments: 0,
      segmentBuildTelemetry: createEmptySegmentBuildTelemetry(),
      numCullCandidates: 0,
      numRenderedMeshes: 0,
      numFrustumCulledMeshes: 0,
      numProjectedSizeCulledMeshes: 0,
      numRTCTiles: 0,
      numRTCTileMatrixUploads: 0,
      numMeshesWithRTCTile: 0,
      numMeshesUsingRTCFallback: 0,
      numCullSegmentCandidates: 0,
      numFrustumCulledSegments: 0,
      numFullyDrawnSegments: 0,
      numPartiallyRefinedSegments: 0,
      numTemporaryIndexBuffers: 0,
      instanceUpload: createEmptyInstanceBufferUploadStats(),
      commandState: createCommandEncoderStats(),
      cpuTime: {
        frameMs: 0,
        prepareMs: 0,
        binningMs: 0,
        batchingMs: 0,
        drawBatchMs: 0,
        uploadMs: 0,
        commandEncodingMs: 0,
        submitMs: 0
      },
      gpuTime: {
        available: false,
        pending: false,
        passes: {}
      }
    };
    this.renderStats.views![viewIndex] = this._currentFrame;
    this._currentBin = null;
  }

  public setRenderReason(reason: string): void {
    if (this.enabled && this._currentFrame) {
      this._currentFrame.renderReason = reason;
    }
  }

  public renderBinStarted(name: string): void {
    if (!this.enabled || !this._currentFrame) {
      return;
    }
    this.renderBinEnded();
    const t = nowMs();
    this._currentBin = {
      name,
      drawCalls: [],
      commandState: createCommandEncoderStats(),
      timeMs: {start: t, end: t, duration: 0}
    };
    this._currentFrame.renderBins.push(this._currentBin);
  }

  public pipelineBound(): void {
    this._mutateCommandState((commandState) => {
      commandState.numPipelineBinds++;
    });
  }

  public vertexBufferBound(_slot: number): void {
    this._mutateCommandState((commandState) => {
      commandState.numVertexBufferBinds++;
    });
  }

  public indexBufferBound(): void {
    this._mutateCommandState((commandState) => {
      commandState.numIndexBufferBinds++;
    });
  }

  public bindGroupBound(slot: number): void {
    this._mutateCommandState((commandState) => {
      commandState.numBindGroupBinds++;
      const key = String(slot);
      commandState.bindGroupBindsBySlot[key] = (commandState.bindGroupBindsBySlot[key] ?? 0) + 1;
    });
  }

  public submissionGroupsSubmitted(groups: {
    submissionGroups: number;
    bufferPageGroups: number;
    renderStateGroups: number;
  }): void {
    this._mutateCommandState((commandState) => {
      commandState.numSubmissionGroups += groups.submissionGroups;
      commandState.numBufferPageGroups += groups.bufferPageGroups;
      commandState.numRenderStateGroups += groups.renderStateGroups;
    });
  }

  public drawBatches(params: {
    renderPass: string;
    technique: string;
    batches: InstancedDrawBatch[];
  }): void {
    if (!this.enabled || !this._currentFrame || !this._currentBin) {
      return;
    }
    for (let i = 0, len = params.batches.length; i < len; i++) {
      const batch = params.batches[i].packedBatch;
      const edges = batch.topology === "edges";
      const numPrims = Math.floor(batch.indexCount / (edges ? 2 : 3));
      this._currentBin.drawCalls.push({
        renderPass: params.renderPass,
        primitive: edges ? "EDGES" : "TRIANGLES",
        technique: params.technique,
        batchLabel: batch.label,
        segmentKey: batch.segmentKey,
        bufferPageKey: batch.bufferPageKey,
        renderStateKey: batch.renderStateKey,
        indexCount: batch.indexCount,
        numPrims,
        instanceCount: 1,
        timeMs: {start: 0, end: 0, duration: 0}
      });
      this._currentFrame.numDrawCalls++;
      this._currentFrame.numPrims += numPrims;
      this._currentFrame.numInstances++;
      this._currentFrame.numBatches++;
      if (batch.temporaryIndexBufferCreated) {
        this._currentFrame.numTemporaryIndexBuffers++;
        batch.temporaryIndexBufferCreated = false;
      }
    }
  }

  public addSegments(count: number): void {
    if (this.enabled && this._currentFrame) {
      this._currentFrame.numSegments += count;
    }
  }

  public setSegmentQueueStats(params: {
    built: number;
    pending: number;
    buildTelemetry?: TriangleSegmentBuildTelemetry;
  }): void {
    if (this.enabled && this._currentFrame) {
      this._currentFrame.numBuiltSegments = params.built;
      this._currentFrame.numPendingSegments = params.pending;
      this._currentFrame.segmentBuildTelemetry = cloneSegmentBuildTelemetry(params.buildTelemetry);
    }
  }

  public setCullStats(params: {
    considered: number;
    rendered: number;
    frustumCulled: number;
    projectedSizeCulled: number;
    segmentCandidates?: number;
    segmentFrustumCulled?: number;
    segmentFullyDrawn?: number;
    segmentPartiallyRefined?: number;
  }): void {
    if (this.enabled && this._currentFrame) {
      this._currentFrame.numCullCandidates = params.considered;
      this._currentFrame.numRenderedMeshes = params.rendered;
      this._currentFrame.numFrustumCulledMeshes = params.frustumCulled;
      this._currentFrame.numProjectedSizeCulledMeshes = params.projectedSizeCulled;
      this._currentFrame.numCullSegmentCandidates = params.segmentCandidates ?? 0;
      this._currentFrame.numFrustumCulledSegments = params.segmentFrustumCulled ?? 0;
      this._currentFrame.numFullyDrawnSegments = params.segmentFullyDrawn ?? 0;
      this._currentFrame.numPartiallyRefinedSegments = params.segmentPartiallyRefined ?? 0;
    }
  }

  public setRTCStats(params: {
    tiles: number;
    tileMatrixUploads: number;
    meshesWithRTCTile: number;
    meshesUsingFallback: number;
  }): void {
    if (this.enabled && this._currentFrame) {
      this._currentFrame.numRTCTiles = params.tiles;
      this._currentFrame.numRTCTileMatrixUploads = params.tileMatrixUploads;
      this._currentFrame.numMeshesWithRTCTile = params.meshesWithRTCTile;
      this._currentFrame.numMeshesUsingRTCFallback = params.meshesUsingFallback;
    }
  }

  public addCPUTime(name: keyof ViewRenderStats["cpuTime"], durationMs: number): void {
    if (this.enabled && this._currentFrame) {
      this._currentFrame.cpuTime[name] += durationMs;
    }
  }

  public setInstanceUploadStats(stats: InstanceBufferUploadStats): void {
    if (this.enabled && this._currentFrame) {
      this._currentFrame.instanceUpload = {...stats};
    }
  }

  public markGPUTimesPending(viewIndex: number): void {
    if (!this.enabled) {
      return;
    }
    const frame = this.renderStats.views?.[viewIndex];
    if (frame) {
      frame.gpuTime.available = true;
      frame.gpuTime.pending = true;
      frame.gpuTime.passes = {};
    }
  }

  public setGPUTimes(viewIndex: number, passes: {[passName: string]: number}): void {
    if (!this.enabled) {
      return;
    }
    const frame = this.renderStats.views?.[viewIndex];
    if (frame) {
      frame.gpuTime.available = true;
      frame.gpuTime.pending = false;
      frame.gpuTime.passes = passes;
    }
  }

  public renderBinEnded(): void {
    if (!this.enabled || !this._currentBin?.timeMs) {
      return;
    }
    const t = nowMs();
    this._currentBin.timeMs.end = t;
    this._currentBin.timeMs.duration = t - this._currentBin.timeMs.start;
    this._currentBin = null;
  }

  public frameEnded(): void {
    if (!this.enabled || !this._currentFrame?.timeMs) {
      return;
    }
    this.renderBinEnded();
    const t = nowMs();
    const frame = this._currentFrame;
    frame.timeMs.end = t;
    frame.timeMs.duration = t - frame.timeMs.start;
    frame.cpuTime.frameMs = frame.timeMs.duration;

    const lastEnd = this._lastFrameEndByViewId[frame.viewId];
    if (lastEnd !== undefined && t > lastEnd) {
      this._frameRatesByViewId[frame.viewId] = 1000 / (t - lastEnd);
    }
    this._lastFrameEndByViewId[frame.viewId] = t;
    this._currentFrame = null;
    this._currentBin = null;
  }

  public getFrameRate(viewId: string): number | null {
    return this._frameRatesByViewId[viewId] ?? null;
  }

  private _mutateCommandState(mutator: (commandState: ViewRenderStats["commandState"]) => void): void {
    if (!this.enabled || !this._currentFrame) {
      return;
    }
    mutator(this._currentFrame.commandState);
    if (this._currentBin) {
      mutator(this._currentBin.commandState);
    }
  }
}

function createEmptySegmentBuildTelemetry(): TriangleSegmentBuildTelemetry {
  return {
    totalSegmentsBuilt: 0,
    totalBuildMs: 0,
    totalPackMs: 0,
    totalUploadMs: 0,
    totalMeshCount: 0,
    totalVertexCount: 0,
    totalIndexCount: 0,
    totalEdgeIndexCount: 0,
    lastBuildSegments: 0,
    lastBuildMs: 0,
    lastBuildPackMs: 0,
    lastBuildUploadMs: 0,
    lastBuildPendingBefore: 0,
    lastBuildPendingAfter: 0,
    recentSamples: [],
    slowestSamples: []
  };
}

function createEmptyInstanceBufferUploadStats(): InstanceBufferUploadStats {
  return {
    writeCount: 0,
    byteLength: 0,
    rangeCount: 0,
    maxRangeSlots: 0,
    fullUpload: false,
    copiedByteLength: 0
  };
}

function cloneSegmentBuildTelemetry(telemetry?: TriangleSegmentBuildTelemetry): TriangleSegmentBuildTelemetry {
  if (!telemetry) {
    return createEmptySegmentBuildTelemetry();
  }
  return {
    ...telemetry,
    recentSamples: telemetry.recentSamples.map((sample) => ({...sample})),
    slowestSamples: telemetry.slowestSamples.map((sample) => ({...sample}))
  };
}
