import {SDKErrorType, type SDKResult} from "../../../../../base/core";
import type {WebGPUBindGroupLike, WebGPURenderPassEncoderLike} from "../../core";
import type {CommandStateTracker, DrawOp, InstancedDrawBatch, InstancedDrawBatches, RenderPassDrawOps} from "../drawOps";
import type {RenderInspector} from "../inspectors";

/**
 * Submits classified triangle draw bins to WebGPU draw operations.
 *
 * @internal
 */
export class TriangleDrawBinSubmitter {

  private readonly _renderInspector: RenderInspector;

  constructor(renderInspector: RenderInspector) {
    this._renderInspector = renderInspector;
  }

  public drawBatchList(params: {
    passEncoder: WebGPURenderPassEncoderLike;
    commandStateTracker: CommandStateTracker;
    frameBindGroup: WebGPUBindGroupLike;
    instanceBindGroup: WebGPUBindGroupLike;
    batches: InstancedDrawBatch[];
    renderPass: string;
    technique: string;
    drawOp: DrawOp | undefined;
    missingMessage: string;
  }): SDKResult<void> {
    if (params.batches.length === 0) {
      return this._ok();
    }
    this._renderInspector.renderBinStarted(params.renderPass);
    this._renderInspector.drawBatches({
      renderPass: params.renderPass,
      technique: params.technique,
      batches: params.batches
    });
    const drawResult = params.drawOp?.drawBatches({
      passEncoder: params.passEncoder,
      commandStateTracker: params.commandStateTracker,
      frameBindGroup: params.frameBindGroup,
      instanceBindGroup: params.instanceBindGroup,
      batches: params.batches,
      commandStats: this._renderInspector
    });
    if (!drawResult) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: params.missingMessage
      };
    }
    return drawResult;
  }

  public drawStyleBinBatchLists(params: {
    passEncoder: WebGPURenderPassEncoderLike;
    commandStateTracker: CommandStateTracker;
    frameBindGroup: WebGPUBindGroupLike;
    instanceBindGroup: WebGPUBindGroupLike;
    triangleDrawOps: RenderPassDrawOps;
    batches: InstancedDrawBatches;
    transparent: boolean;
  }): SDKResult<void> {
    const fillMissingMessage = params.transparent
      ? "[RenderManager.renderView] Transparent triangle draw operation was not initialized."
      : "[RenderManager.renderView] Opaque triangle draw operation was not initialized.";
    const entries = params.transparent
      ? [
          ["STYLE_BIN_TRANSPARENT", params.batches.styleBinTransparent, fillMissingMessage],
          ["STYLE_BIN_EDGES_TRANSPARENT", params.batches.styleBinEdgesTransparent, "TrianglesDrawEdgeColorTechnique", params.triangleDrawOps.edges, "[RenderManager.renderView] Edge triangle draw operation was not initialized."]
        ] as const
      : [
          ["STYLE_BIN_OPAQUE", params.batches.styleBinOpaque, fillMissingMessage],
          ["STYLE_BIN_EDGES_OPAQUE", params.batches.styleBinEdgesOpaque, "TrianglesDrawEdgeColorTechnique", params.triangleDrawOps.edges, "[RenderManager.renderView] Edge triangle draw operation was not initialized."]
        ] as const;

    for (const entry of entries) {
      if (entry.length === 3) {
        const [renderPass, batches, missingMessage] = entry;
        const result = this._drawTriangleFillBatchList({
          passEncoder: params.passEncoder,
          commandStateTracker: params.commandStateTracker,
          frameBindGroup: params.frameBindGroup,
          instanceBindGroup: params.instanceBindGroup,
          triangleDrawOps: params.triangleDrawOps,
          batches,
          renderPass,
          transparent: params.transparent,
          missingMessage
        });
        if (result.ok === false) {
          return result;
        }
        continue;
      }
      const [renderPass, batches, technique, drawOp, missingMessage] = entry;
      const result = this.drawBatchList({
        passEncoder: params.passEncoder,
        commandStateTracker: params.commandStateTracker,
        frameBindGroup: params.frameBindGroup,
        instanceBindGroup: params.instanceBindGroup,
        batches,
        renderPass,
        technique,
        drawOp,
        missingMessage
      });
      if (result.ok === false) {
        return result;
      }
    }

    return this._ok();
  }

  private _drawTriangleFillBatchList(params: {
    passEncoder: WebGPURenderPassEncoderLike;
    commandStateTracker: CommandStateTracker;
    frameBindGroup: WebGPUBindGroupLike;
    instanceBindGroup: WebGPUBindGroupLike;
    triangleDrawOps: RenderPassDrawOps;
    batches: InstancedDrawBatch[];
    renderPass: string;
    transparent: boolean;
    missingMessage: string;
  }): SDKResult<void> {
    const flatBatches = params.batches.filter((batch) => batch.packedBatch.triangleRenderClass === "flat");
    const noNormalsBatches = params.batches.filter((batch) => batch.packedBatch.triangleRenderClass !== "flat" && batch.packedBatch.hasNormals !== true);
    const pbrBatches = params.batches.filter((batch) => batch.packedBatch.triangleRenderClass !== "flat" && batch.packedBatch.hasNormals === true);
    const entries = [
      [
        flatBatches,
        "TrianglesDrawColorFlatTechnique",
        params.transparent ? params.triangleDrawOps.flatTransparent : params.triangleDrawOps.flatOpaque,
        params.missingMessage
      ],
      [
        noNormalsBatches,
        "TrianglesDrawColorNoNormalsTechnique",
        params.transparent ? params.triangleDrawOps.noNormalsTransparent : params.triangleDrawOps.noNormalsOpaque,
        params.missingMessage
      ],
      [
        pbrBatches,
        "TrianglesDrawColorTechnique",
        params.transparent ? params.triangleDrawOps.transparent : params.triangleDrawOps.opaque,
        params.missingMessage
      ]
    ] as const;

    for (const [batches, technique, drawOp, missingMessage] of entries) {
      const result = this.drawBatchList({
        passEncoder: params.passEncoder,
        commandStateTracker: params.commandStateTracker,
        frameBindGroup: params.frameBindGroup,
        instanceBindGroup: params.instanceBindGroup,
        batches,
        renderPass: params.renderPass,
        technique,
        drawOp,
        missingMessage
      });
      if (result.ok === false) {
        return result;
      }
    }

    return this._ok();
  }

  private _ok(): SDKResult<void> {
    return {
      ok: true,
      value: undefined
    };
  }
}
