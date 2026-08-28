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

  public drawEmphasisBatchLists(params: {
    passEncoder: WebGPURenderPassEncoderLike;
    commandStateTracker: CommandStateTracker;
    frameBindGroup: WebGPUBindGroupLike;
    instanceBindGroup: WebGPUBindGroupLike;
    triangleDrawOps: RenderPassDrawOps;
    batches: InstancedDrawBatches;
    transparent: boolean;
    flatColorMode: boolean;
  }): SDKResult<void> {
    const fillDrawOp = params.flatColorMode
      ? (params.transparent ? params.triangleDrawOps.flatTransparent : params.triangleDrawOps.flatOpaque)
      : (params.transparent ? params.triangleDrawOps.transparent : params.triangleDrawOps.opaque);
    const fillTechnique = params.flatColorMode ? "TrianglesDrawColorFlatTechnique" : "TrianglesDrawColorTechnique";
    const fillMissingMessage = params.transparent
      ? "[RenderManager.renderView] Transparent triangle draw operation was not initialized."
      : "[RenderManager.renderView] Opaque triangle draw operation was not initialized.";
    const entries = params.transparent
      ? [
          ["XRAYED_TRANSPARENT", params.batches.xrayedTransparent, fillTechnique, fillDrawOp, fillMissingMessage],
          ["XRAYED_EDGES_TRANSPARENT", params.batches.xrayedEdgesTransparent, "TrianglesDrawEdgeColorTechnique", params.triangleDrawOps.edges, "[RenderManager.renderView] Edge triangle draw operation was not initialized."],
          ["HIGHLIGHTED_TRANSPARENT", params.batches.highlightedTransparent, fillTechnique, fillDrawOp, fillMissingMessage],
          ["HIGHLIGHTED_EDGES_TRANSPARENT", params.batches.highlightedEdgesTransparent, "TrianglesDrawEdgeColorTechnique", params.triangleDrawOps.edges, "[RenderManager.renderView] Edge triangle draw operation was not initialized."],
          ["SELECTED_TRANSPARENT", params.batches.selectedTransparent, fillTechnique, fillDrawOp, fillMissingMessage],
          ["SELECTED_EDGES_TRANSPARENT", params.batches.selectedEdgesTransparent, "TrianglesDrawEdgeColorTechnique", params.triangleDrawOps.edges, "[RenderManager.renderView] Edge triangle draw operation was not initialized."]
        ] as const
      : [
          ["XRAYED_OPAQUE", params.batches.xrayedOpaque, fillTechnique, fillDrawOp, fillMissingMessage],
          ["XRAYED_EDGES_OPAQUE", params.batches.xrayedEdgesOpaque, "TrianglesDrawEdgeColorTechnique", params.triangleDrawOps.edges, "[RenderManager.renderView] Edge triangle draw operation was not initialized."],
          ["HIGHLIGHTED_OPAQUE", params.batches.highlightedOpaque, fillTechnique, fillDrawOp, fillMissingMessage],
          ["HIGHLIGHTED_EDGES_OPAQUE", params.batches.highlightedEdgesOpaque, "TrianglesDrawEdgeColorTechnique", params.triangleDrawOps.edges, "[RenderManager.renderView] Edge triangle draw operation was not initialized."],
          ["SELECTED_OPAQUE", params.batches.selectedOpaque, fillTechnique, fillDrawOp, fillMissingMessage],
          ["SELECTED_EDGES_OPAQUE", params.batches.selectedEdgesOpaque, "TrianglesDrawEdgeColorTechnique", params.triangleDrawOps.edges, "[RenderManager.renderView] Edge triangle draw operation was not initialized."]
        ] as const;

    for (const [renderPass, batches, technique, drawOp, missingMessage] of entries) {
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

  private _ok(): SDKResult<void> {
    return {
      ok: true,
      value: undefined
    };
  }
}
