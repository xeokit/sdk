import type {SDKResult} from "../../../../base/core";
import type {WebGPUBindGroupLike, WebGPURenderPassEncoderLike} from "../../core";
import type {WebGPUInstancedDrawBatch} from "../types";
import type {WebGPURenderPassValue} from "../RENDER_PASSES";
import type {WebGPUDrawTechnique} from "./WebGPUDrawTechnique";

/**
 * Parameters passed to a WebGPU draw op.
 *
 * @internal
 */
export interface WebGPUDrawOpParams {
  passEncoder: WebGPURenderPassEncoderLike;
  frameBindGroup: WebGPUBindGroupLike;
  instanceBindGroup: WebGPUBindGroupLike;
  batches: WebGPUInstancedDrawBatch[];
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
export class WebGPUDrawOp {

  public readonly technique: WebGPUDrawTechnique;
  public readonly renderPass: WebGPURenderPassValue;

  constructor(technique: WebGPUDrawTechnique, renderPass: WebGPURenderPassValue) {
    this.technique = technique;
    this.renderPass = renderPass;
  }

  public drawBatches(params: WebGPUDrawOpParams): SDKResult<void> {
    const pipelineStateResult = this.technique.getPipelineState(this.renderPass);
    if (pipelineStateResult.ok === false) {
      return pipelineStateResult;
    }
    return this.technique.drawBatches({
      ...params,
      pipelineState: pipelineStateResult.value
    });
  }
}
