import type {View} from "../../viewer";
import type {WebGPUDrawItem, WebGPUInstancedDrawBatch, WebGPUInstancedDrawBatches, WebGPURenderBins} from "./types";
import {WebGPUInstanceBufferManager} from "./WebGPUInstanceBufferManager";
import {WebGPUMeshManager} from "./WebGPUMeshManager";

/**
 * Builds instanced draw batches from classified WebGPU render bins.
 *
 * @internal
 */
export class WebGPUInstanceBatcher {

  private readonly _batches: WebGPUInstancedDrawBatches = {
    opaque: [],
    transparent: []
  };
  private readonly _batchPool: WebGPUInstancedDrawBatch[] = [];
  private readonly _opaqueGroups: {[geometryUniqueId: string]: WebGPUDrawItem[]} = {};
  private readonly _opaqueGroupKeys: string[] = [];
  private _batchPoolCount = 0;

  public get batches(): WebGPUInstancedDrawBatches {
    return this._batches;
  }

  public build(params: {
    bins: WebGPURenderBins;
    view: View;
    meshManager: WebGPUMeshManager;
    instanceBufferManager: WebGPUInstanceBufferManager;
  }): WebGPUInstancedDrawBatches {
    const {bins, view, meshManager, instanceBufferManager} = params;

    this._clear();
    this._buildOpaqueBatches(bins.normalDrawOpaque, view, meshManager, instanceBufferManager);
    this._buildTransparentBatches(bins.normalFillTransparent, view, meshManager, instanceBufferManager);
    instanceBufferManager.upload();

    return this._batches;
  }

  private _clear(): void {
    this._batches.opaque.length = 0;
    this._batches.transparent.length = 0;
    this._batchPoolCount = 0;
    for (let i = 0, len = this._opaqueGroupKeys.length; i < len; i++) {
      this._opaqueGroups[this._opaqueGroupKeys[i]].length = 0;
    }
    this._opaqueGroupKeys.length = 0;
  }

  private _buildOpaqueBatches(
    drawItems: WebGPUDrawItem[],
    view: View,
    meshManager: WebGPUMeshManager,
    instanceBufferManager: WebGPUInstanceBufferManager
  ): void {
    for (let i = 0, len = drawItems.length; i < len; i++) {
      const drawItem = drawItems[i];
      const geometryUniqueId = drawItem.meshState.geometryState.geometry.uniqueId;
      let group = this._opaqueGroups[geometryUniqueId];
      if (!group) {
        group = [];
        this._opaqueGroups[geometryUniqueId] = group;
      }
      if (group.length === 0) {
        this._opaqueGroupKeys.push(geometryUniqueId);
      }
      group.push(drawItem);
    }

    for (let i = 0, len = this._opaqueGroupKeys.length; i < len; i++) {
      const group = this._opaqueGroups[this._opaqueGroupKeys[i]];
      const firstInstance = instanceBufferManager.appendDrawItems({
        drawItems: group,
        start: 0,
        count: group.length,
        view,
        meshManager
      });
      this._batches.opaque.push(this._nextBatch(group[0], firstInstance, group.length));
    }
  }

  private _buildTransparentBatches(
    drawItems: WebGPUDrawItem[],
    view: View,
    meshManager: WebGPUMeshManager,
    instanceBufferManager: WebGPUInstanceBufferManager
  ): void {
    let start = 0;
    const len = drawItems.length;
    while (start < len) {
      const geometryState = drawItems[start].meshState.geometryState;
      let end = start + 1;
      while (
        end < len &&
        drawItems[end].meshState.geometryState === geometryState
      ) {
        end++;
      }

      const count = end - start;
      const firstInstance = instanceBufferManager.appendDrawItems({
        drawItems,
        start,
        count,
        view,
        meshManager
      });
      this._batches.transparent.push(this._nextBatch(drawItems[start], firstInstance, count));
      start = end;
    }
  }

  private _nextBatch(drawItem: WebGPUDrawItem, firstInstance: number, instanceCount: number): WebGPUInstancedDrawBatch {
    let batch = this._batchPool[this._batchPoolCount];
    if (!batch) {
      batch = {
        geometryState: drawItem.meshState.geometryState,
        firstInstance,
        instanceCount
      };
      this._batchPool.push(batch);
    } else {
      batch.geometryState = drawItem.meshState.geometryState;
      batch.firstInstance = firstInstance;
      batch.instanceCount = instanceCount;
    }
    this._batchPoolCount++;
    return batch;
  }
}
