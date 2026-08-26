import {type SDKResult} from "../../../../../base/core";
import type {View} from "../../../../viewer";
import type {SceneTexture} from "../../../../../model/scene";
import type {InstancedDrawBatch, InstancedDrawBatches} from "../drawOps";
import type {DrawItem, RenderBins} from "../renderState";
import {MeshManager} from "../meshManager";
import {RenderContext} from "../RenderContext";
import {
  BindGroupLayoutManager,
  TriangleBatchManager,
  type TriangleBatchPrepareOptions,
  type TriangleBatchSegment,
  type TriangleBatchSet,
  type InstanceBufferFrame
} from "../gpuMemoryManager";
import type {RTCTileManager} from "./RTCTileManager";

/**
 * Builds minimum-draw-call mesh batches from classified WebGPU render bins.
 *
 * @internal
 */
export class InstanceBatcher {

  private readonly _renderContext: RenderContext;
  private readonly _triangleBatchManager: TriangleBatchManager;
  private readonly _batches: InstancedDrawBatches = {
    opaque: [],
    edges: [],
    transparent: [],
    overlayOpaque: [],
    overlayTransparent: [],
    xrayedOpaque: [],
    xrayedEdgesOpaque: [],
    xrayedTransparent: [],
    xrayedEdgesTransparent: [],
    highlightedOpaque: [],
    highlightedEdgesOpaque: [],
    highlightedTransparent: [],
    highlightedEdgesTransparent: [],
    selectedOpaque: [],
    selectedEdgesOpaque: [],
    selectedTransparent: [],
    selectedEdgesTransparent: []
  };

  constructor(params: {
    renderContext: RenderContext;
    bindGroupLayoutManager: BindGroupLayoutManager;
    rtcTileManager: RTCTileManager;
  }) {
    this._renderContext = params.renderContext;
    this._triangleBatchManager = new TriangleBatchManager({
      renderContext: params.renderContext,
      bindGroupLayoutManager: params.bindGroupLayoutManager,
      memoryConfigs: params.renderContext.memoryConfigs,
      rtcTileResolver: params.rtcTileManager
    });
  }

  public get batches(): InstancedDrawBatches {
    return this._batches;
  }

  public getMemoryStats() {
    return this._triangleBatchManager.getMemoryStats();
  }

  public sceneTextureImageDataChanged(sceneTexture: SceneTexture): void {
    this._triangleBatchManager.sceneTextureImageDataChanged(sceneTexture);
  }

  public prepare(meshManager: MeshManager): SDKResult<number> {
    const batchResult = this._triangleBatchManager.prepare(meshManager);
    if (batchResult.ok === false) {
      return batchResult;
    }
    return {
      ok: true,
      value: batchResult.value.instanceCapacity
    };
  }

  public prepareBatchSet(meshManager: MeshManager, options?: TriangleBatchPrepareOptions): SDKResult<TriangleBatchSet> {
    return this._triangleBatchManager.prepare(meshManager, options);
  }

  public buildPendingSegments(meshManager: MeshManager): SDKResult<TriangleBatchSet> {
    return this._triangleBatchManager.buildPendingSegments(meshManager);
  }

  public writeInstances(params: {
    batchSet: TriangleBatchSet;
    segments?: TriangleBatchSegment[];
    view: View;
    meshManager: MeshManager;
    instanceFrame: InstanceBufferFrame;
  }): void {
    this._triangleBatchManager.writeInstances(params);
  }

  public build(params: {
    bins: RenderBins;
    view: View;
    meshManager: MeshManager;
    instanceFrame: InstanceBufferFrame;
    includeEdges?: boolean;
  }): SDKResult<InstancedDrawBatches> {
    const {bins, view, meshManager, instanceFrame} = params;

    this._clear();

    const batchResult = this._triangleBatchManager.prepare(meshManager);
    if (batchResult.ok === false) {
      return batchResult;
    }
    const triangleBatch = batchResult.value;
    return this.buildPrepared({
      batchSet: triangleBatch,
      bins,
      view,
      meshManager,
      instanceFrame,
      includeEdges: params.includeEdges
    });
  }

  public buildPrepared(params: {
    batchSet: TriangleBatchSet;
    bins: RenderBins;
    view: View;
    meshManager: MeshManager;
    instanceFrame: InstanceBufferFrame;
    includeEdges?: boolean;
  }): SDKResult<InstancedDrawBatches> {
    const {batchSet, bins, view, meshManager, instanceFrame} = params;
    const includeEdges = params.includeEdges ?? true;

    this._clear();

    const triangleBatch = batchSet;
    if (triangleBatch.segments.length === 0) {
      instanceFrame.instanceCount = 0;
      return {
        ok: true,
        value: this._batches
      };
    }

    this._triangleBatchManager.writeInstances({
      batchSet: triangleBatch,
      view,
      meshManager,
      instanceFrame
    });

    const opaqueBatchResult = this._appendOpaqueBatches({
      batchSet: triangleBatch,
      drawItems: filterDrawItemsByOverlay(bins.normalDrawOpaque, false),
      viewId: view.id
    });
    if (opaqueBatchResult.ok === false) {
      this._destroyBatches(this._batches);
      this._clear();
      return opaqueBatchResult;
    }

    if (includeEdges) {
      const edgeBatchResult = this._appendEdgeBatches({
        batchSet: triangleBatch,
      drawItems: filterDrawItemsByOverlay(bins.normalEdgesOpaque, false),
      viewId: view.id,
      pass: "edges"
      });
      if (edgeBatchResult.ok === false) {
        this._destroyBatches(this._batches);
        this._clear();
        return edgeBatchResult;
      }
    }

    const transparentBatchResult = this._appendTransparentBatches({
      batchSet: triangleBatch,
      drawItems: filterDrawItemsByOverlay(bins.normalFillTransparent, false),
      viewId: view.id,
      pass: "transparent"
    });
    if (transparentBatchResult.ok === false) {
      this._destroyBatches(this._batches);
      this._clear();
      return transparentBatchResult;
    }

    const overlayOpaqueBatchResult = this._appendOpaqueBatches({
      batchSet: triangleBatch,
      drawItems: filterDrawItemsByOverlay(bins.normalDrawOpaque, true),
      viewId: view.id,
      pass: "overlayOpaque",
      target: this._batches.overlayOpaque
    });
    if (overlayOpaqueBatchResult.ok === false) {
      this._destroyBatches(this._batches);
      this._clear();
      return overlayOpaqueBatchResult;
    }

    const overlayTransparentBatchResult = this._appendTransparentBatches({
      batchSet: triangleBatch,
      drawItems: filterDrawItemsByOverlay(bins.normalFillTransparent, true),
      viewId: view.id,
      pass: "overlayTransparent",
      target: this._batches.overlayTransparent
    });
    if (overlayTransparentBatchResult.ok === false) {
      this._destroyBatches(this._batches);
      this._clear();
      return overlayTransparentBatchResult;
    }

    const emphasisResults = [
      this._appendOpaqueBatches({batchSet: triangleBatch, drawItems: bins.xrayedFillOpaque, viewId: view.id, pass: "xrayedOpaque", target: this._batches.xrayedOpaque}),
      includeEdges ? this._appendEdgeBatches({batchSet: triangleBatch, drawItems: bins.xrayedEdgesOpaque, viewId: view.id, pass: "xrayedEdgesOpaque", target: this._batches.xrayedEdgesOpaque}) : null,
      this._appendTransparentBatches({batchSet: triangleBatch, drawItems: bins.xrayedFillTransparent, viewId: view.id, pass: "xrayedTransparent", target: this._batches.xrayedTransparent}),
      includeEdges ? this._appendEdgeBatches({batchSet: triangleBatch, drawItems: bins.xrayedEdgesTransparent, viewId: view.id, pass: "xrayedEdgesTransparent", target: this._batches.xrayedEdgesTransparent}) : null,
      this._appendOpaqueBatches({batchSet: triangleBatch, drawItems: bins.highlightedFillOpaque, viewId: view.id, pass: "highlightedOpaque", target: this._batches.highlightedOpaque}),
      includeEdges ? this._appendEdgeBatches({batchSet: triangleBatch, drawItems: bins.highlightedEdgesOpaque, viewId: view.id, pass: "highlightedEdgesOpaque", target: this._batches.highlightedEdgesOpaque}) : null,
      this._appendTransparentBatches({batchSet: triangleBatch, drawItems: bins.highlightedFillTransparent, viewId: view.id, pass: "highlightedTransparent", target: this._batches.highlightedTransparent}),
      includeEdges ? this._appendEdgeBatches({batchSet: triangleBatch, drawItems: bins.highlightedEdgesTransparent, viewId: view.id, pass: "highlightedEdgesTransparent", target: this._batches.highlightedEdgesTransparent}) : null,
      this._appendOpaqueBatches({batchSet: triangleBatch, drawItems: bins.selectedFillOpaque, viewId: view.id, pass: "selectedOpaque", target: this._batches.selectedOpaque}),
      includeEdges ? this._appendEdgeBatches({batchSet: triangleBatch, drawItems: bins.selectedEdgesOpaque, viewId: view.id, pass: "selectedEdgesOpaque", target: this._batches.selectedEdgesOpaque}) : null,
      this._appendTransparentBatches({batchSet: triangleBatch, drawItems: bins.selectedFillTransparent, viewId: view.id, pass: "selectedTransparent", target: this._batches.selectedTransparent}),
      includeEdges ? this._appendEdgeBatches({batchSet: triangleBatch, drawItems: bins.selectedEdgesTransparent, viewId: view.id, pass: "selectedEdgesTransparent", target: this._batches.selectedEdgesTransparent}) : null
    ];
    for (const result of emphasisResults) {
      if (result === null) {
        continue;
      }
      if (result.ok === false) {
        this._destroyBatches(this._batches);
        this._clear();
        return result;
      }
    }

    return {
      ok: true,
      value: this._batches
    };
  }

  public buildTransparent(params: {
    bins: RenderBins;
    view: View;
    meshManager: MeshManager;
    includeEdges?: boolean;
  }): SDKResult<InstancedDrawBatches> {
    const {bins, view, meshManager} = params;
    const includeEdges = params.includeEdges ?? true;

    this._clear();

    const batchResult = this._triangleBatchManager.prepare(meshManager);
    if (batchResult.ok === false) {
      return batchResult;
    }

    return this.buildTransparentPrepared({
      batchSet: batchResult.value,
      bins,
      view,
      includeEdges
    });
  }

  public buildTransparentPrepared(params: {
    batchSet: TriangleBatchSet;
    bins: RenderBins;
    view: View;
    includeEdges?: boolean;
  }): SDKResult<InstancedDrawBatches> {
    const {batchSet, bins, view} = params;
    const includeEdges = params.includeEdges ?? true;

    this._clear();

    const transparentBatchResult = this._appendTransparentBatches({
      batchSet,
      drawItems: filterDrawItemsByOverlay(bins.normalFillTransparent, false),
      viewId: view.id,
      pass: "transparent"
    });
    if (transparentBatchResult.ok === false) {
      this._destroyBatches(this._batches);
      this._clear();
      return transparentBatchResult;
    }

    const overlayTransparentBatchResult = this._appendTransparentBatches({
      batchSet,
      drawItems: filterDrawItemsByOverlay(bins.normalFillTransparent, true),
      viewId: view.id,
      pass: "overlayTransparent",
      target: this._batches.overlayTransparent
    });
    if (overlayTransparentBatchResult.ok === false) {
      this._destroyBatches(this._batches);
      this._clear();
      return overlayTransparentBatchResult;
    }

    const emphasisResults = [
      this._appendTransparentBatches({batchSet, drawItems: bins.xrayedFillTransparent, viewId: view.id, pass: "xrayedTransparent", target: this._batches.xrayedTransparent}),
      includeEdges ? this._appendEdgeBatches({batchSet, drawItems: bins.xrayedEdgesTransparent, viewId: view.id, pass: "xrayedEdgesTransparent", target: this._batches.xrayedEdgesTransparent}) : null,
      this._appendTransparentBatches({batchSet, drawItems: bins.highlightedFillTransparent, viewId: view.id, pass: "highlightedTransparent", target: this._batches.highlightedTransparent}),
      includeEdges ? this._appendEdgeBatches({batchSet, drawItems: bins.highlightedEdgesTransparent, viewId: view.id, pass: "highlightedEdgesTransparent", target: this._batches.highlightedEdgesTransparent}) : null,
      this._appendTransparentBatches({batchSet, drawItems: bins.selectedFillTransparent, viewId: view.id, pass: "selectedTransparent", target: this._batches.selectedTransparent}),
      includeEdges ? this._appendEdgeBatches({batchSet, drawItems: bins.selectedEdgesTransparent, viewId: view.id, pass: "selectedEdgesTransparent", target: this._batches.selectedEdgesTransparent}) : null
    ];
    for (const result of emphasisResults) {
      if (result === null) {
        continue;
      }
      if (result.ok === false) {
        this._destroyBatches(this._batches);
        this._clear();
        return result;
      }
    }

    return {
      ok: true,
      value: this._batches
    };
  }

  public buildOpaque(params: {
    batchSet: TriangleBatchSet;
    drawItems: DrawItem[];
    viewId: string;
  }): SDKResult<InstancedDrawBatch[]> {
    this._clear();
    const result = this._appendOpaqueBatches(params);
    if (result.ok === false) {
      this._destroyBatches(this._batches);
      this._clear();
      return result;
    }
    const opaque = this._batches.opaque.slice();
    this._batches.opaque.length = 0;
    return {
      ok: true,
      value: opaque
    };
  }

  public buildEdges(params: {
    batchSet: TriangleBatchSet;
    drawItems: DrawItem[];
    viewId: string;
  }): SDKResult<InstancedDrawBatch[]> {
    this._clear();
    const result = this._appendEdgeBatches(params);
    if (result.ok === false) {
      this._destroyBatches(this._batches);
      this._clear();
      return result;
    }
    const edges = this._batches.edges.slice();
    this._batches.edges.length = 0;
    return {
      ok: true,
      value: edges
    };
  }

  private _appendEdgeBatches(params: {
    batchSet: TriangleBatchSet;
    drawItems: DrawItem[];
    viewId: string;
    pass?: string;
    target?: InstancedDrawBatch[];
  }): SDKResult<void> {
    const pass = params.pass ?? "edges";
    const target = params.target ?? this._batches.edges;
    const groups = new Map<TriangleBatchSegment, DrawItem[]>();
    for (let i = 0, len = params.drawItems.length; i < len; i++) {
      const drawItem = params.drawItems[i];
      const segment = params.batchSet.segmentByMeshId[drawItem.meshState.mesh.uniqueId];
      if (!segment) {
        continue;
      }
      let group = groups.get(segment);
      if (!group) {
        group = [];
        groups.set(segment, group);
      }
      group.push(drawItem);
    }

    let ordinal = 0;
    for (let i = 0, len = params.batchSet.segments.length; i < len; i++) {
      const segment = params.batchSet.segments[i];
      const drawItems = groups.get(segment);
      if (!drawItems?.length) {
        continue;
      }
      const result = this._triangleBatchManager.createDrawBatch({
        segment,
        drawItems,
        label: `${params.viewId}:${pass}:${segment.label}:${ordinal++}`,
        topology: "edges",
        renderStateKey: pass,
        cacheKey: this._getDrawBatchCacheKey(params.viewId, pass, segment, drawItems),
        reuseFullSegmentIndex: true
      });
      if (result.ok === false) {
        return result;
      }
      if (result.value) {
        target.push(result.value);
      }
    }

    return {
      ok: true,
      value: undefined
    };
  }

  private _appendOpaqueBatches(params: {
    batchSet: TriangleBatchSet;
    drawItems: DrawItem[];
    viewId: string;
    pass?: string;
    target?: InstancedDrawBatch[];
  }): SDKResult<void> {
    const pass = params.pass ?? "opaque";
    const target = params.target ?? this._batches.opaque;
    const groups = new Map<TriangleBatchSegment, DrawItem[]>();
    for (let i = 0, len = params.drawItems.length; i < len; i++) {
      const drawItem = params.drawItems[i];
      const segment = params.batchSet.segmentByMeshId[drawItem.meshState.mesh.uniqueId];
      if (!segment) {
        continue;
      }
      let group = groups.get(segment);
      if (!group) {
        group = [];
        groups.set(segment, group);
      }
      group.push(drawItem);
    }

    let ordinal = 0;
    for (let i = 0, len = params.batchSet.segments.length; i < len; i++) {
      const segment = params.batchSet.segments[i];
      const drawItems = groups.get(segment);
      if (!drawItems?.length) {
        continue;
      }
      const result = this._triangleBatchManager.createDrawBatch({
        segment,
        drawItems,
        label: `${params.viewId}:${pass}:${segment.label}:${ordinal++}`,
        renderStateKey: pass,
        cacheKey: this._getDrawBatchCacheKey(params.viewId, pass, segment, drawItems),
        reuseFullSegmentIndex: true
      });
      if (result.ok === false) {
        return result;
      }
      if (result.value) {
        target.push(result.value);
      }
    }

    return {
      ok: true,
      value: undefined
    };
  }

  private _appendTransparentBatches(params: {
    batchSet: TriangleBatchSet;
    drawItems: DrawItem[];
    viewId: string;
    pass?: string;
    target?: InstancedDrawBatch[];
  }): SDKResult<void> {
    const pass = params.pass ?? "transparent";
    const target = params.target ?? this._batches.transparent;
    if (this._renderContext.renderConfigs.transparentSortStrategy === "segment") {
      return this._appendSegmentGroupedTransparentBatches({
        ...params,
        pass,
        target
      });
    }

    let currentSegment: TriangleBatchSegment | null = null;
    let currentItems: DrawItem[] = [];
    let ordinal = 0;

    const flush = (): SDKResult<void> => {
      if (!currentSegment || currentItems.length === 0) {
        return {
          ok: true,
          value: undefined
        };
      }
      const result = this._triangleBatchManager.createDrawBatch({
        segment: currentSegment,
        drawItems: currentItems,
        label: `${params.viewId}:${pass}:${currentSegment.label}:${ordinal++}`,
        renderStateKey: pass,
        cacheKey: this._getDrawBatchCacheKey(params.viewId, pass, currentSegment, currentItems)
      });
      if (result.ok === false) {
        return result;
      }
      if (result.value) {
        target.push(result.value);
      }
      currentItems = [];
      return {
        ok: true,
        value: undefined
      };
    };

    for (let i = 0, len = params.drawItems.length; i < len; i++) {
      const drawItem = params.drawItems[i];
      const segment = params.batchSet.segmentByMeshId[drawItem.meshState.mesh.uniqueId];
      if (!segment) {
        continue;
      }
      if (currentSegment && currentSegment !== segment) {
        const result = flush();
        if (result.ok === false) {
          return result;
        }
      }
      currentSegment = segment;
      currentItems.push(drawItem);
    }

    return flush();
  }

  private _appendSegmentGroupedTransparentBatches(params: {
    batchSet: TriangleBatchSet;
    drawItems: DrawItem[];
    viewId: string;
    pass: string;
    target: InstancedDrawBatch[];
  }): SDKResult<void> {
    const groups = new Map<TriangleBatchSegment, DrawItem[]>();
    const segmentOrder: TriangleBatchSegment[] = [];
    for (let i = 0, len = params.drawItems.length; i < len; i++) {
      const drawItem = params.drawItems[i];
      const segment = params.batchSet.segmentByMeshId[drawItem.meshState.mesh.uniqueId];
      if (!segment) {
        continue;
      }
      let group = groups.get(segment);
      if (!group) {
        group = [];
        groups.set(segment, group);
        segmentOrder.push(segment);
      }
      group.push(drawItem);
    }

    let ordinal = 0;
    for (let i = 0, len = segmentOrder.length; i < len; i++) {
      const segment = segmentOrder[i];
      const drawItems = groups.get(segment);
      if (!drawItems?.length) {
        continue;
      }
      const result = this._triangleBatchManager.createDrawBatch({
        segment,
        drawItems,
        label: `${params.viewId}:${params.pass}:${segment.label}:${ordinal++}`,
        renderStateKey: params.pass,
        cacheKey: this._getDrawBatchCacheKey(params.viewId, params.pass, segment, drawItems)
      });
      if (result.ok === false) {
        return result;
      }
      if (result.value) {
        params.target.push(result.value);
      }
    }

    return {
      ok: true,
      value: undefined
    };
  }

  private _clear(): void {
    this._batches.opaque.length = 0;
    this._batches.edges.length = 0;
    this._batches.transparent.length = 0;
    this._batches.overlayOpaque.length = 0;
    this._batches.overlayTransparent.length = 0;
    this._batches.xrayedOpaque.length = 0;
    this._batches.xrayedEdgesOpaque.length = 0;
    this._batches.xrayedTransparent.length = 0;
    this._batches.xrayedEdgesTransparent.length = 0;
    this._batches.highlightedOpaque.length = 0;
    this._batches.highlightedEdgesOpaque.length = 0;
    this._batches.highlightedTransparent.length = 0;
    this._batches.highlightedEdgesTransparent.length = 0;
    this._batches.selectedOpaque.length = 0;
    this._batches.selectedEdgesOpaque.length = 0;
    this._batches.selectedTransparent.length = 0;
    this._batches.selectedEdgesTransparent.length = 0;
  }

  private _getDrawBatchCacheKey(
    viewId: string,
    pass: string,
    segment: TriangleBatchSegment,
    drawItems: DrawItem[]
  ): string {
    const meshIds: string[] = [];
    for (let i = 0, len = drawItems.length; i < len; i++) {
      meshIds.push(drawItems[i].meshState.mesh.uniqueId);
    }
    return `${viewId}|${pass}|${segment.key}|${meshIds.join(",")}`;
  }

  private _destroyBatches(batches: InstancedDrawBatches): void {
    for (let i = 0, len = batches.opaque.length; i < len; i++) {
      batches.opaque[i].packedBatch.destroy();
    }
    for (let i = 0, len = batches.edges.length; i < len; i++) {
      batches.edges[i].packedBatch.destroy();
    }
    for (let i = 0, len = batches.transparent.length; i < len; i++) {
      batches.transparent[i].packedBatch.destroy();
    }
    for (const batchList of [
      batches.overlayOpaque,
      batches.overlayTransparent,
      batches.xrayedOpaque,
      batches.xrayedEdgesOpaque,
      batches.xrayedTransparent,
      batches.xrayedEdgesTransparent,
      batches.highlightedOpaque,
      batches.highlightedEdgesOpaque,
      batches.highlightedTransparent,
      batches.highlightedEdgesTransparent,
      batches.selectedOpaque,
      batches.selectedEdgesOpaque,
      batches.selectedTransparent,
      batches.selectedEdgesTransparent
    ]) {
      for (let i = 0, len = batchList.length; i < len; i++) {
        batchList[i].packedBatch.destroy();
      }
    }
  }

  public destroy(): void {
    this._destroyBatches(this._batches);
    this._clear();
    this._triangleBatchManager.destroy();
  }
}

function filterDrawItemsByOverlay(drawItems: DrawItem[], overlay: boolean): DrawItem[] {
  return drawItems.filter((drawItem) => (drawItem.meshState.mesh.bin === "overlay") === overlay);
}
