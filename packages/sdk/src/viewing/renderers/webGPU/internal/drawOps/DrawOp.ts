import type {SDKResult} from "../../../../../base/core";
import type {WebGPUBindGroupLike, WebGPURenderPassEncoderLike} from "../../core";
import type {WebGPURenderPassValue} from "../RENDER_PASSES";
import type {InstancedDrawBatch} from "./InstancedDrawBatch";
import type {DrawTechnique} from "./DrawTechnique";
import type {CommandEncoderStatsSink} from "../inspectors";
import {CommandStateTracker} from "./CommandStateTracker";

/**
 * Parameters passed to a WebGPU draw op.
 *
 * @internal
 */
export interface DrawOpParams {
  passEncoder: WebGPURenderPassEncoderLike;
  frameBindGroup: WebGPUBindGroupLike;
  instanceBindGroup: WebGPUBindGroupLike;
  batches: InstancedDrawBatch[];
  commandStats?: CommandEncoderStatsSink;
  commandStateTracker?: CommandStateTracker;
}

/**
 * Binds a WebGPU draw technique to a render pass.
 *
 * This mirrors WebGL's DrawOp shape at the current WebGPU feature level. The
 * operation is intentionally thin: render pass selection lives here, concrete
 * binding and draw calls stay in the technique.
 *
 * @internal
 */
export class DrawOp {

  public readonly technique: DrawTechnique;
  public readonly renderPass: WebGPURenderPassValue;

  constructor(technique: DrawTechnique, renderPass: WebGPURenderPassValue) {
    this.technique = technique;
    this.renderPass = renderPass;
  }

  public drawBatches(params: DrawOpParams): SDKResult<void> {
    const pipelineStateResult = this.technique.getPipelineState(this.renderPass);
    if (pipelineStateResult.ok === false) {
      return pipelineStateResult;
    }
    const commandStateTracker = params.commandStateTracker ?? new CommandStateTracker({
      passEncoder: params.passEncoder,
      commandStats: params.commandStats
    });
    return this.technique.drawBatches({
      ...params,
      commandStateTracker,
      renderPass: this.renderPass,
      pipelineState: pipelineStateResult.value
    });
  }
}
