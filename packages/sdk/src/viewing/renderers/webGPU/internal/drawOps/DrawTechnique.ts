import type {SDKResult} from "../../../../../base/core";
import type {WebGPUBindGroupLike, WebGPURenderPassEncoderLike} from "../../core";
import type {WebGPURenderPassValue} from "../RENDER_PASSES";
import type {BindGroupLayoutManager} from "../gpuMemoryManager";
import type {RenderContext} from "../RenderContext";
import type {InstancedDrawBatch} from "./InstancedDrawBatch";
import type {PipelineState} from "./PipelineState";
import type {CommandEncoderStatsSink} from "../inspectors";
import type {CommandStateTracker} from "./CommandStateTracker";

/**
 * Parameters passed to a WebGPU draw technique when issuing instanced batches.
 *
 * @internal
 */
export interface DrawBatchesParams {
  passEncoder: WebGPURenderPassEncoderLike;
  pipelineState: PipelineState;
  frameBindGroup: WebGPUBindGroupLike;
  instanceBindGroup: WebGPUBindGroupLike;
  batches: InstancedDrawBatch[];
  renderPass: WebGPURenderPassValue;
  commandStats?: CommandEncoderStatsSink;
  commandStateTracker: CommandStateTracker;
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
export abstract class DrawTechnique {

  protected readonly _renderContext: RenderContext;
  protected readonly _bindGroupLayoutManager: BindGroupLayoutManager;

  constructor(params: {
    renderContext: RenderContext;
    bindGroupLayoutManager: BindGroupLayoutManager;
  }) {
    this._renderContext = params.renderContext;
    this._bindGroupLayoutManager = params.bindGroupLayoutManager;
  }

  public abstract getPipelineState(renderPass: WebGPURenderPassValue): SDKResult<PipelineState>;

  public abstract drawBatches(params: DrawBatchesParams): SDKResult<void>;

  public destroy(): void {
    // Hook for future techniques that own backend resources directly.
  }
}
