import {SDKErrorType, type SDKResult} from "../../../base/core";
import type {WebGPUBindGroupLike, WebGPUBufferLike, WebGPURenderPassEncoderLike} from "../core";
import {RENDER_PASSES} from "./RENDER_PASSES";
import type {WebGPUInstancedDrawBatch, WebGPUInstancedDrawBatches, WebGPUPipelineState, WebGPURenderBins} from "./types";
import {WebGPUFrameUniformManager} from "./WebGPUFrameUniformManager";
import {WebGPUInstanceBatcher} from "./WebGPUInstanceBatcher";
import {WebGPUInstanceBufferManager} from "./WebGPUInstanceBufferManager";
import {WebGPUMeshManager} from "./WebGPUMeshManager";
import {WebGPUPipelineManager} from "./WebGPUPipelineManager";
import {WebGPURenderBinClassifier} from "./WebGPURenderBinClassifier";
import {WebGPURenderContext} from "./WebGPURenderContext";
import {WebGPUView} from "./WebGPUView";

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
  private readonly _bins: WebGPURenderBins = {
    normalDrawOpaque: [],
    normalFillTransparent: []
  };
  private readonly _binClassifier = new WebGPURenderBinClassifier();
  private readonly _instanceBatcher = new WebGPUInstanceBatcher();

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
      const meshStates = this._meshManager.meshStates;
      this._binClassifier.clear(this._bins);
      this._binClassifier.classify({
        meshStates,
        view,
        meshManager: this._meshManager,
        bins: this._bins
      });
      const totalInstances = this._bins.normalDrawOpaque.length + this._bins.normalFillTransparent.length;
      const instanceFrameResult = this._instanceBufferManager.beginFrame(totalInstances);
      if (instanceFrameResult.ok === false) {
        return instanceFrameResult;
      }
      const drawBatches = this._instanceBatcher.build({
        bins: this._bins,
        view,
        meshManager: this._meshManager,
        instanceBufferManager: this._instanceBufferManager
      });

      const opaquePipelineResult = drawBatches.opaque.length > 0
        ? this._pipelineManager.getMeshPipelineState(RENDER_PASSES.OPAQUE)
        : null;
      if (opaquePipelineResult?.ok === false) {
        return opaquePipelineResult;
      }
      const transparentPipelineResult = drawBatches.transparent.length > 0
        ? this._pipelineManager.getMeshPipelineState(RENDER_PASSES.TRANSPARENT)
        : null;
      if (transparentPipelineResult?.ok === false) {
        return transparentPipelineResult;
      }
      const frameBindGroupResult = totalInstances > 0
        ? this._frameUniformManager.writeFrameUniforms(view)
        : null;
      if (frameBindGroupResult?.ok === false) {
        return frameBindGroupResult;
      }
      const instanceBuffer = this._instanceBufferManager.buffer;
      if (totalInstances > 0 && !instanceBuffer) {
        return {
          ok: false,
          type: SDKErrorType.InitializationFailed,
          error: "[WebGPURenderManager.renderView] Instance buffer was not initialized."
        };
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

      if (drawBatches.opaque.length > 0) {
        this._drawInstancedBatches(
          passEncoder,
          opaquePipelineResult!.value,
          frameBindGroupResult!.value,
          instanceBuffer!,
          drawBatches.opaque
        );
      }
      if (drawBatches.transparent.length > 0) {
        this._drawInstancedBatches(
          passEncoder,
          transparentPipelineResult!.value,
          frameBindGroupResult!.value,
          instanceBuffer!,
          drawBatches.transparent
        );
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
    this._instanceBufferManager.destroy();
    this._frameUniformManager.destroy();
  }

  private _drawInstancedBatches(
    passEncoder: WebGPURenderPassEncoderLike,
    pipelineState: WebGPUPipelineState,
    frameBindGroup: WebGPUBindGroupLike,
    instanceBuffer: WebGPUBufferLike,
    batches: WebGPUInstancedDrawBatch[]
  ): void {
    if (
      !passEncoder.setPipeline ||
      !passEncoder.setVertexBuffer ||
      !passEncoder.setIndexBuffer ||
      !passEncoder.setBindGroup ||
      !passEncoder.drawIndexed
    ) {
      throw new Error("WebGPU render pass encoder does not expose indexed drawing methods.");
    }

    passEncoder.setPipeline(pipelineState.renderPipeline);
    passEncoder.setBindGroup(0, frameBindGroup);
    passEncoder.setVertexBuffer(2, instanceBuffer);

    for (const batch of batches) {
      const geometryState = batch.geometryState;
      passEncoder.setVertexBuffer(0, geometryState.vertexBuffer);
      passEncoder.setVertexBuffer(1, geometryState.normalBuffer);
      passEncoder.setIndexBuffer(geometryState.indexBuffer, geometryState.indexFormat);
      passEncoder.drawIndexed(geometryState.indexCount, batch.instanceCount, 0, 0, batch.firstInstance);
    }
  }

  private _endRenderPass(passEncoder: WebGPURenderPassEncoderLike): void {
    if (typeof passEncoder.end === "function") {
      passEncoder.end();
      return;
    }
    passEncoder.endPass?.();
  }
}
