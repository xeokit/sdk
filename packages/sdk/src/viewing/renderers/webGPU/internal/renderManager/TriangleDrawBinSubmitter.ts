import {SDKErrorType, type SDKResult} from "../../../../../base/core";
import type {WebGPUBindGroupLike, WebGPUDeviceLike, WebGPURenderBundleLike, WebGPURenderPassEncoderLike} from "../../core";
import {CommandStateTracker, type DrawOp, type InstancedDrawBatch, type InstancedDrawBatches, type RenderPassDrawOps} from "../drawOps";
import type {RenderInspector} from "../inspectors";

const nowMs = (): number => {
  const performanceLike = (globalThis as {performance?: {now?: () => number}}).performance;
  return performanceLike?.now ? performanceLike.now() : Date.now();
};

interface RenderBundleCacheEntry {
  key: string;
  bundle: WebGPURenderBundleLike;
}

/**
 * Submits classified triangle draw bins to WebGPU draw operations.
 *
 * @internal
 */
export class TriangleDrawBinSubmitter {

  private readonly _renderInspector: RenderInspector;
  private readonly _flatScratch: InstancedDrawBatch[] = [];
  private readonly _noNormalsScratch: InstancedDrawBatch[] = [];
  private readonly _pbrScratch: InstancedDrawBatch[] = [];
  private readonly _renderBundleCache = new Map<string, RenderBundleCacheEntry>();
  private readonly _objectIds = new WeakMap<object, number>();
  private _nextObjectId = 1;

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
    renderBundle?: {
      device: WebGPUDeviceLike;
      colorFormat: string;
      depthStencilFormat: string;
    };
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
    const submissionStart = this._renderInspector.active ? nowMs() : 0;
    const drawResult = params.drawOp
      ? this._drawOrExecuteBundle(params as typeof params & {drawOp: DrawOp})
      : undefined;
    if (this._renderInspector.active) {
      this._renderInspector.addCPUTime("drawSubmissionMs", nowMs() - submissionStart);
    }
    if (!drawResult) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: params.missingMessage
      };
    }
    return drawResult;
  }

  private _drawOrExecuteBundle(params: {
    passEncoder: WebGPURenderPassEncoderLike;
    commandStateTracker: CommandStateTracker;
    frameBindGroup: WebGPUBindGroupLike;
    instanceBindGroup: WebGPUBindGroupLike;
    batches: InstancedDrawBatch[];
    renderPass: string;
    technique: string;
    drawOp: DrawOp;
    renderBundle?: {
      device: WebGPUDeviceLike;
      colorFormat: string;
      depthStencilFormat: string;
    };
  }): SDKResult<void> {
    const bundleConfig = params.renderBundle;
    if (!bundleConfig ||
      !bundleConfig.device.createRenderBundleEncoder ||
      !params.passEncoder.executeBundles ||
      params.batches.some((batch) => batch.packedBatch.temporaryIndexBuffer === true)) {
      if (bundleConfig) {
        this._renderInspector.renderBundleFallback();
      }
      return params.drawOp.drawBatches({
        passEncoder: params.passEncoder,
        commandStateTracker: params.commandStateTracker,
        frameBindGroup: params.frameBindGroup,
        instanceBindGroup: params.instanceBindGroup,
        batches: params.batches,
        commandStats: this._renderInspector
      });
    }

    const cacheId = `${params.renderPass}|${params.technique}`;
    const key = this._createRenderBundleKey(params, bundleConfig);
    const cached = this._renderBundleCache.get(cacheId);
    if (cached?.key === key) {
      params.passEncoder.executeBundles([cached.bundle]);
      this._renderInspector.renderBundleReplayed();
      return this._ok();
    }
    if (cached) {
      this._renderInspector.renderBundleInvalidated();
    }

    const bundleEncoder = bundleConfig.device.createRenderBundleEncoder({
      label: `xeokit-webgpu-${params.renderPass}-${params.technique}-bundle`,
      colorFormats: [bundleConfig.colorFormat],
      depthStencilFormat: bundleConfig.depthStencilFormat
    });
    const bundleCommandState = new CommandStateTracker({
      passEncoder: bundleEncoder,
      commandStats: this._renderInspector
    });
    const drawResult = params.drawOp.drawBatches({
      passEncoder: bundleEncoder,
      commandStateTracker: bundleCommandState,
      frameBindGroup: params.frameBindGroup,
      instanceBindGroup: params.instanceBindGroup,
      batches: params.batches,
      commandStats: this._renderInspector
    });
    if (drawResult.ok === false) {
      this._renderInspector.renderBundleFallback();
      return params.drawOp.drawBatches({
        passEncoder: params.passEncoder,
        commandStateTracker: params.commandStateTracker,
        frameBindGroup: params.frameBindGroup,
        instanceBindGroup: params.instanceBindGroup,
        batches: params.batches,
        commandStats: this._renderInspector
      });
    }
    const bundle = bundleEncoder.finish({
      label: `xeokit-webgpu-${params.renderPass}-${params.technique}-bundle`
    });
    this._renderBundleCache.set(cacheId, {
      key,
      bundle
    });
    this._renderInspector.renderBundleRecorded();
    params.passEncoder.executeBundles([bundle]);
    return this._ok();
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
        const result = this.drawTriangleFillBatchList({
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

  public drawTriangleFillBatchList(params: {
    passEncoder: WebGPURenderPassEncoderLike;
    commandStateTracker: CommandStateTracker;
    frameBindGroup: WebGPUBindGroupLike;
    instanceBindGroup: WebGPUBindGroupLike;
    triangleDrawOps: RenderPassDrawOps;
    batches: InstancedDrawBatch[];
    renderPass: string;
    transparent: boolean;
    missingMessage: string;
    renderBundle?: {
      device: WebGPUDeviceLike;
      colorFormat: string;
      depthStencilFormat: string;
    };
  }): SDKResult<void> {
    const classificationStart = this._renderInspector.active ? nowMs() : 0;
    const flatBatches = this._flatScratch;
    const noNormalsBatches = this._noNormalsScratch;
    const pbrBatches = this._pbrScratch;
    flatBatches.length = 0;
    noNormalsBatches.length = 0;
    pbrBatches.length = 0;
    for (let i = 0, len = params.batches.length; i < len; i++) {
      const batch = params.batches[i];
      if (batch.packedBatch.triangleRenderClass === "flat") {
        flatBatches.push(batch);
      } else if (batch.packedBatch.hasNormals !== true) {
        noNormalsBatches.push(batch);
      } else {
        pbrBatches.push(batch);
      }
    }
    if (this._renderInspector.active) {
      this._renderInspector.addCPUTime("triangleFillClassificationMs", nowMs() - classificationStart);
    }
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
        missingMessage,
        renderBundle: params.renderBundle
      });
      if (result.ok === false) {
        return result;
      }
    }

    return this._ok();
  }

  private _createRenderBundleKey(params: {
    frameBindGroup: WebGPUBindGroupLike;
    instanceBindGroup: WebGPUBindGroupLike;
    batches: InstancedDrawBatch[];
    renderPass: string;
    technique: string;
  }, bundleConfig: {
    colorFormat: string;
    depthStencilFormat: string;
  }): string {
    const parts = [
      params.renderPass,
      params.technique,
      bundleConfig.colorFormat,
      bundleConfig.depthStencilFormat,
      this._getObjectId(params.frameBindGroup),
      this._getObjectId(params.instanceBindGroup),
      params.batches.length
    ];
    for (let i = 0, len = params.batches.length; i < len; i++) {
      const batch = params.batches[i].packedBatch;
      parts.push(
        batch.label,
        batch.segmentKey,
        batch.bufferPageKey ?? "",
        batch.renderStateKey ?? "",
        batch.textureKey ?? "",
        batch.topology ?? "triangles",
        batch.indexFormat,
        batch.indexCount,
        batch.firstIndex ?? 0,
        batch.indexBufferOffset ?? 0,
        batch.vertexBufferOffset ?? 0,
        batch.vertexMetadataBufferOffset ?? 0,
        batch.colorBufferOffset ?? 0,
        batch.uvBufferOffset ?? 0,
        batch.normalBufferOffset ?? 0,
        batch.materialBufferOffset ?? 0,
        this._getObjectId(batch.vertexBuffer),
        this._getObjectId(batch.vertexMetadataBuffer),
        this._getObjectId(batch.indexBuffer),
        batch.colorBuffer ? this._getObjectId(batch.colorBuffer) : 0,
        batch.uvBuffer ? this._getObjectId(batch.uvBuffer) : 0,
        batch.normalBuffer ? this._getObjectId(batch.normalBuffer) : 0,
        batch.materialBuffer ? this._getObjectId(batch.materialBuffer) : 0,
        this._getObjectId(batch.positionDecodeBindGroup),
        batch.colorBindGroup ? this._getObjectId(batch.colorBindGroup) : 0
      );
    }
    return parts.join("|");
  }

  private _getObjectId(value: object): number {
    let id = this._objectIds.get(value);
    if (id === undefined) {
      id = this._nextObjectId++;
      this._objectIds.set(value, id);
    }
    return id;
  }

  private _ok(): SDKResult<void> {
    return {
      ok: true,
      value: undefined
    };
  }
}
