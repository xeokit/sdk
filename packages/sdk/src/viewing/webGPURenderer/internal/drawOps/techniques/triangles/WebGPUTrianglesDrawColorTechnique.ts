import {SDKErrorType, type SDKResult} from "../../../../../../base/core";
import type {WebGPUPipelineState} from "../../../types";
import type {WebGPURenderPassValue} from "../../../RENDER_PASSES";
import type {WebGPUPipelineManager} from "../../../WebGPUPipelineManager";
import {WebGPUDrawTechnique, type WebGPUDrawBatchesParams} from "../../WebGPUDrawTechnique";

/**
 * WebGPU draw technique for the current indexed triangle color path.
 *
 * @internal
 */
export class WebGPUTrianglesDrawColorTechnique extends WebGPUDrawTechnique {

  constructor(pipelineManager: WebGPUPipelineManager) {
    super(pipelineManager);
  }

  public getPipelineState(renderPass: WebGPURenderPassValue): SDKResult<WebGPUPipelineState> {
    return this._pipelineManager.getMeshPipelineState(renderPass);
  }

  public drawBatches(params: WebGPUDrawBatchesParams): SDKResult<void> {
    const {passEncoder, pipelineState, frameBindGroup, instanceBindGroup, batches} = params;

    if (
      !passEncoder.setPipeline ||
      !passEncoder.setVertexBuffer ||
      !passEncoder.setIndexBuffer ||
      !passEncoder.setBindGroup ||
      !passEncoder.drawIndexed
    ) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[WebGPUTrianglesDrawColorTechnique.drawBatches] WebGPU render pass encoder does not expose indexed drawing methods."
      };
    }

    passEncoder.setPipeline(pipelineState.renderPipeline);
    passEncoder.setBindGroup(0, frameBindGroup);
    passEncoder.setBindGroup(1, instanceBindGroup);

    for (const batch of batches) {
      const packedBatch = batch.packedBatch;
      passEncoder.setVertexBuffer(0, packedBatch.vertexBuffer);
      passEncoder.setVertexBuffer(1, packedBatch.normalBuffer);
      passEncoder.setVertexBuffer(2, packedBatch.meshIndexBuffer);
      passEncoder.setIndexBuffer(packedBatch.indexBuffer, packedBatch.indexFormat);
      passEncoder.drawIndexed(packedBatch.indexCount, 1, 0, 0, 0);
    }

    return {
      ok: true,
      value: undefined
    };
  }
}
