import {type SDKResult} from "../../../base/core";
import type {View} from "../../viewer";
import type {WebGPUInstancedDrawBatches, WebGPURenderBins} from "./types";
import {WebGPUInstanceBufferManager, type WebGPUInstanceBufferFrame} from "./WebGPUInstanceBufferManager";
import {WebGPUMeshManager} from "./WebGPUMeshManager";
import {WebGPUPackedMeshBatchBuilder} from "./WebGPUPackedMeshBatchBuilder";
import {WebGPURenderContext} from "./WebGPURenderContext";

/**
 * Builds minimum-draw-call mesh batches from classified WebGPU render bins.
 *
 * @internal
 */
export class WebGPUInstanceBatcher {

  private readonly _packedBatchBuilder: WebGPUPackedMeshBatchBuilder;
  private readonly _batches: WebGPUInstancedDrawBatches = {
    opaque: [],
    transparent: []
  };

  constructor(renderContext: WebGPURenderContext) {
    this._packedBatchBuilder = new WebGPUPackedMeshBatchBuilder(renderContext);
  }

  public get batches(): WebGPUInstancedDrawBatches {
    return this._batches;
  }

  public build(params: {
    bins: WebGPURenderBins;
    view: View;
    meshManager: WebGPUMeshManager;
    instanceBufferManager: WebGPUInstanceBufferManager;
    instanceFrame: WebGPUInstanceBufferFrame;
  }): SDKResult<WebGPUInstancedDrawBatches> {
    const {bins, view, meshManager, instanceBufferManager, instanceFrame} = params;

    this._clear();

    const opaqueBatchResult = this._packedBatchBuilder.build({
      drawItems: bins.normalDrawOpaque,
      label: `${view.id}:opaque`,
      view,
      meshManager,
      instanceBufferManager,
      instanceFrame
    });
    if (opaqueBatchResult.ok === false) {
      return opaqueBatchResult;
    }
    if (opaqueBatchResult.value) {
      this._batches.opaque.push({
        packedBatch: opaqueBatchResult.value
      });
    }

    const transparentBatchResult = this._packedBatchBuilder.build({
      drawItems: bins.normalFillTransparent,
      label: `${view.id}:transparent`,
      view,
      meshManager,
      instanceBufferManager,
      instanceFrame
    });
    if (transparentBatchResult.ok === false) {
      this._destroyBatches(this._batches);
      this._clear();
      return transparentBatchResult;
    }
    if (transparentBatchResult.value) {
      this._batches.transparent.push({
        packedBatch: transparentBatchResult.value
      });
    }

    instanceBufferManager.upload(instanceFrame);

    return {
      ok: true,
      value: this._batches
    };
  }

  private _clear(): void {
    this._batches.opaque.length = 0;
    this._batches.transparent.length = 0;
  }

  private _destroyBatches(batches: WebGPUInstancedDrawBatches): void {
    for (let i = 0, len = batches.opaque.length; i < len; i++) {
      batches.opaque[i].packedBatch.destroy();
    }
    for (let i = 0, len = batches.transparent.length; i < len; i++) {
      batches.transparent[i].packedBatch.destroy();
    }
  }
}
