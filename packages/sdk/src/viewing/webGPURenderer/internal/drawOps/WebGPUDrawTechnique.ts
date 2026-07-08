import type {SDKResult} from "../../../../base/core";
import type {WebGPUBindGroupLike, WebGPURenderPassEncoderLike} from "../../core";
import type {WebGPUInstancedDrawBatch, WebGPUPipelineState} from "../types";
import type {WebGPURenderPassValue} from "../RENDER_PASSES";
import type {WebGPUPipelineManager} from "../WebGPUPipelineManager";

/**
 * Parameters passed to a WebGPU draw technique when issuing instanced batches.
 *
 * @internal
 */
export interface WebGPUDrawBatchesParams {
  passEncoder: WebGPURenderPassEncoderLike;
  pipelineState: WebGPUPipelineState;
  frameBindGroup: WebGPUBindGroupLike;
  instanceBindGroup: WebGPUBindGroupLike;
  batches: WebGPUInstancedDrawBatch[];
}

/**
 * Base class for WebGPU draw techniques.
 *
 * Mirrors the WebGL renderer's DrawTechnique role: subclasses own the concrete
 * pipeline/draw binding for a primitive family, while render managers only
 * decide which render pass is running.
 *
 * @internal
 */
export abstract class WebGPUDrawTechnique {

  protected readonly _pipelineManager: WebGPUPipelineManager;

  constructor(pipelineManager: WebGPUPipelineManager) {
    this._pipelineManager = pipelineManager;
  }

  public abstract getPipelineState(renderPass: WebGPURenderPassValue): SDKResult<WebGPUPipelineState>;

  public abstract drawBatches(params: WebGPUDrawBatchesParams): SDKResult<void>;

  public destroy(): void {
    // Hook for future techniques that own backend resources directly.
  }
}
