import {SDKErrorType, type SDKResult} from "../../../base/core";
import {TrianglesPrimitive} from "../../../base/constants";
import type {WebGPURenderPassEncoderLike} from "../core";
import {WebGPUDrawOps} from "./drawOps";
import type {WebGPUInstancedDrawBatches, WebGPURenderBins} from "./types";
import {WebGPUFrameUniformManager} from "./WebGPUFrameUniformManager";
import {WebGPUInstanceBatcher} from "./WebGPUInstanceBatcher";
import {WebGPUInstanceBufferManager, type WebGPUInstanceBufferFrame} from "./WebGPUInstanceBufferManager";
import {WebGPUMeshManager} from "./WebGPUMeshManager";
import {WebGPUPipelineManager} from "./WebGPUPipelineManager";
import {WebGPURenderBinClassifier} from "./WebGPURenderBinClassifier";
import {WebGPURenderContext} from "./WebGPURenderContext";
import {WebGPUView} from "./WebGPUView";

interface WebGPUViewRenderCache {
  structureVersion: number;
  instanceDataVersion: number;
  viewStateVersion: number;
  cameraViewVersion: number;
  hasTransparent: boolean;
  totalInstances: number;
  instanceFrame: WebGPUInstanceBufferFrame | null;
  batches: WebGPUInstancedDrawBatches;
}

/**
 * Owns WebGPU render pass creation and draw submission.
 *
 * @internal
 */
export class WebGPURenderManager {

  private readonly _renderContext: WebGPURenderContext;
  private readonly _pipelineManager: WebGPUPipelineManager;
  private readonly _meshManager: WebGPUMeshManager;
  private readonly _frameUniformManager: WebGPUFrameUniformManager;
  private readonly _instanceBufferManager: WebGPUInstanceBufferManager;
  private readonly _drawOps: WebGPUDrawOps;
  private readonly _bins: WebGPURenderBins = {
    normalDrawOpaque: [],
    normalFillTransparent: []
  };
  private readonly _binClassifier = new WebGPURenderBinClassifier();
  private readonly _instanceBatcher: WebGPUInstanceBatcher;
  private readonly _viewRenderCaches: {[viewId: string]: WebGPUViewRenderCache} = {};

  constructor(params: {
    renderContext: WebGPURenderContext;
    pipelineManager: WebGPUPipelineManager;
    meshManager: WebGPUMeshManager;
    frameUniformManager: WebGPUFrameUniformManager;
    instanceBufferManager: WebGPUInstanceBufferManager;
  }) {
    this._renderContext = params.renderContext;
    this._pipelineManager = params.pipelineManager;
    this._meshManager = params.meshManager;
    this._frameUniformManager = params.frameUniformManager;
    this._instanceBufferManager = params.instanceBufferManager;
    this._drawOps = new WebGPUDrawOps(this._pipelineManager);
    this._instanceBatcher = new WebGPUInstanceBatcher(this._renderContext);
  }

  public init(): SDKResult<void> {
    return this._drawOps.init();
  }

  public renderView(webgpuView: WebGPUView): SDKResult<void> {
    const view = webgpuView.view;

    try {
      webgpuView.configure(this._renderContext);
      if (!webgpuView.depthTextureView) {
        return {
          ok: false,
          type: SDKErrorType.InitializationFailed,
          error: `[WebGPURenderManager.renderView] View '${view.id}' depth texture was not initialized.`
        };
      }

      const backgroundColor = view.backgroundColor;
      const renderCacheResult = this._getOrBuildViewRenderCache(webgpuView);
      if (renderCacheResult.ok === false) {
        return renderCacheResult;
      }
      const renderCache = renderCacheResult.value;
      const totalInstances = renderCache.totalInstances;

      const frameBindGroupResult = totalInstances > 0
        ? this._frameUniformManager.writeFrameUniforms(view)
        : null;
      if (frameBindGroupResult?.ok === false) {
        return frameBindGroupResult;
      }
      const instanceFrame = renderCache.instanceFrame;
      if (totalInstances > 0 && !instanceFrame?.buffer) {
        return {
          ok: false,
          type: SDKErrorType.InitializationFailed,
          error: "[WebGPURenderManager.renderView] Instance buffer was not initialized."
        };
      }
      const instanceBindGroupLayoutResult = totalInstances > 0
        ? this._pipelineManager.getInstanceBindGroupLayout()
        : null;
      if (instanceBindGroupLayoutResult?.ok === false) {
        return instanceBindGroupLayoutResult;
      }
      const instanceBindGroupResult = totalInstances > 0
        ? this._instanceBufferManager.getBindGroup(instanceFrame!, instanceBindGroupLayoutResult!.value)
        : null;
      if (instanceBindGroupResult?.ok === false) {
        return instanceBindGroupResult;
      }

      const device = this._renderContext.device;
      const commandEncoder = device.createCommandEncoder();
      const textureView = webgpuView.context.getCurrentTexture().createView();
      const passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: textureView,
          clearValue: {
            r: backgroundColor[0],
            g: backgroundColor[1],
            b: backgroundColor[2],
            a: view.transparent ? 0 : 1
          },
          loadOp: "clear",
          storeOp: "store"
        }],
        depthStencilAttachment: {
          view: webgpuView.depthTextureView,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store"
        }
      });

      const triangleDrawOps = this._drawOps.prims[TrianglesPrimitive];
      if (!triangleDrawOps) {
        return {
          ok: false,
          type: SDKErrorType.InitializationFailed,
          error: "[WebGPURenderManager.renderView] Triangle draw operations were not initialized."
        };
      }

      if (renderCache.batches.opaque.length > 0) {
        const drawResult = triangleDrawOps.opaque?.drawBatches({
          passEncoder,
          frameBindGroup: frameBindGroupResult!.value,
          instanceBindGroup: instanceBindGroupResult!.value,
          batches: renderCache.batches.opaque
        });
        if (!drawResult) {
          return {
            ok: false,
            type: SDKErrorType.InitializationFailed,
            error: "[WebGPURenderManager.renderView] Opaque triangle draw operation was not initialized."
          };
        }
        if (drawResult.ok === false) {
          return drawResult;
        }
      }

      if (renderCache.batches.transparent.length > 0) {
        const drawResult = triangleDrawOps.transparent?.drawBatches({
          passEncoder,
          frameBindGroup: frameBindGroupResult!.value,
          instanceBindGroup: instanceBindGroupResult!.value,
          batches: renderCache.batches.transparent
        });
        if (!drawResult) {
          return {
            ok: false,
            type: SDKErrorType.InitializationFailed,
            error: "[WebGPURenderManager.renderView] Transparent triangle draw operation was not initialized."
          };
        }
        if (drawResult.ok === false) {
          return drawResult;
        }
      }

      this._endRenderPass(passEncoder);
      device.queue.submit([commandEncoder.finish()]);
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.Unknown,
        error: `[WebGPURenderManager.renderView] Failed to render WebGPU frame: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: undefined
    };
  }

  public destroy(): void {
    for (const viewId of Object.keys(this._viewRenderCaches)) {
      this.viewDestroyed(viewId);
    }
    this._drawOps.destroy();
    this._instanceBufferManager.destroy();
    this._frameUniformManager.destroy();
  }

  public viewDestroyed(viewId: string): void {
    const cache = this._viewRenderCaches[viewId];
    if (cache) {
      this._clearCachedBatches(cache.batches);
    }
    delete this._viewRenderCaches[viewId];
    this._instanceBufferManager.destroyFrame(viewId);
  }

  private _endRenderPass(passEncoder: WebGPURenderPassEncoderLike): void {
    if (typeof passEncoder.end === "function") {
      passEncoder.end();
      return;
    }
    passEncoder.endPass?.();
  }

  private _getOrBuildViewRenderCache(webgpuView: WebGPUView): SDKResult<WebGPUViewRenderCache> {
    const view = webgpuView.view;
    const cache = this._getViewRenderCache(view.id);
    const structureVersion = this._meshManager.structureVersion;
    const instanceDataVersion = this._meshManager.instanceDataVersion;
    const viewStateVersion = this._meshManager.getViewStateVersion(view);
    const cameraViewVersion = this._meshManager.getCameraViewVersion(view);
    const needsRebuild =
      cache.structureVersion !== structureVersion ||
      cache.instanceDataVersion !== instanceDataVersion ||
      cache.viewStateVersion !== viewStateVersion ||
      (cache.hasTransparent && cache.cameraViewVersion !== cameraViewVersion) ||
      (cache.totalInstances > 0 && !cache.instanceFrame?.buffer);

    if (!needsRebuild) {
      return {
        ok: true,
        value: cache
      };
    }

    const meshStates = this._meshManager.meshStates;
    this._binClassifier.clear(this._bins);
    this._binClassifier.classify({
      meshStates,
      view,
      meshManager: this._meshManager,
      bins: this._bins
    });

    const totalInstances = this._bins.normalDrawOpaque.length + this._bins.normalFillTransparent.length;

    if (totalInstances === 0) {
      this._clearCachedBatches(cache.batches);
      cache.instanceFrame = null;
      cache.totalInstances = 0;
      cache.hasTransparent = false;
      cache.structureVersion = structureVersion;
      cache.instanceDataVersion = instanceDataVersion;
      cache.viewStateVersion = viewStateVersion;
      cache.cameraViewVersion = cameraViewVersion;
      this._instanceBufferManager.destroyFrame(view.id);
      return {
        ok: true,
        value: cache
      };
    }

    const instanceFrameResult = this._instanceBufferManager.beginFrame(totalInstances, view.id);
    if (instanceFrameResult.ok === false) {
      return instanceFrameResult;
    }
    cache.instanceFrame = instanceFrameResult.value;

    const drawBatchesResult = this._instanceBatcher.build({
      bins: this._bins,
      view,
      meshManager: this._meshManager,
      instanceBufferManager: this._instanceBufferManager,
      instanceFrame: cache.instanceFrame
    });
    if (drawBatchesResult.ok === false) {
      return drawBatchesResult;
    }
    this._copyBatches(drawBatchesResult.value, cache.batches);
    cache.totalInstances = totalInstances;
    cache.hasTransparent = this._bins.normalFillTransparent.length > 0;
    cache.structureVersion = structureVersion;
    cache.instanceDataVersion = instanceDataVersion;
    cache.viewStateVersion = viewStateVersion;
    cache.cameraViewVersion = cameraViewVersion;

    return {
      ok: true,
      value: cache
    };
  }

  private _getViewRenderCache(viewId: string): WebGPUViewRenderCache {
    let cache = this._viewRenderCaches[viewId];
    if (!cache) {
      cache = {
        structureVersion: -1,
        instanceDataVersion: -1,
        viewStateVersion: -1,
        cameraViewVersion: -1,
        hasTransparent: false,
        totalInstances: 0,
        instanceFrame: null,
        batches: {
          opaque: [],
          transparent: []
        }
      };
      this._viewRenderCaches[viewId] = cache;
    }
    return cache;
  }

  private _copyBatches(source: WebGPUInstancedDrawBatches, target: WebGPUInstancedDrawBatches): void {
    this._clearCachedBatches(target);
    for (let i = 0, len = source.opaque.length; i < len; i++) {
      const batch = source.opaque[i];
      target.opaque.push({
        packedBatch: batch.packedBatch
      });
    }
    for (let i = 0, len = source.transparent.length; i < len; i++) {
      const batch = source.transparent[i];
      target.transparent.push({
        packedBatch: batch.packedBatch
      });
    }
  }

  private _clearCachedBatches(batches: WebGPUInstancedDrawBatches): void {
    for (let i = 0, len = batches.opaque.length; i < len; i++) {
      try {
        batches.opaque[i].packedBatch.destroy();
      } catch {
        // Ignore buffer destruction failures during teardown.
      }
    }
    for (let i = 0, len = batches.transparent.length; i < len; i++) {
      try {
        batches.transparent[i].packedBatch.destroy();
      } catch {
        // Ignore buffer destruction failures during teardown.
      }
    }
    batches.opaque.length = 0;
    batches.transparent.length = 0;
  }
}
