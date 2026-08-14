import {SDKErrorType, type SDKResult} from "../../../../base/core";
import {TrianglesPrimitive} from "../../../../base/constants";
import {createMat4Float64, mulMat4, type Mat4} from "../../../../base/math/matrix";
import type {View} from "../../../viewer";
import type {WebGPURenderPassEncoderLike} from "../../core";
import type {WebGPUMemoryStats} from "../../WebGPUMemoryStats";
import {CommandStateTracker, DrawOps, type InstancedDrawBatch, type InstancedDrawBatches} from "../drawOps";
import {BindGroupLayoutManager, InstanceBufferManager, type InstanceBufferFrame, type TriangleBatchPrepareOptions, type TriangleBatchSegment, type TriangleBatchSet} from "../gpuMemoryManager";
import {RenderInspector} from "../inspectors";
import {MeshManager, type RendererMesh} from "../meshManager";
import type {DrawItem, RenderBins} from "../renderState";
import {RenderContext} from "../RenderContext";
import {ViewRenderState} from "../ViewRenderState";
import {WebGPUFrameAttachments, WebGPUPickBuffer, WebGPUReadbackBufferReader, WebGPUSnapBuffer, WebGPUTimestampQueryManager, type WebGPUTimestampFrame} from "../webGPU";
import {FrameUniformManager} from "./FrameUniformManager";
import {InstanceBatcher} from "./InstanceBatcher";
import {PickPassRenderer} from "./PickPassRenderer";
import {RenderBinClassifier, type RenderCullStats} from "./RenderBinClassifier";
import {SectionPlaneCapRenderer, type SectionPlaneCap} from "./SectionPlaneCapRenderer";
import {SnapPassRenderer} from "./SnapPassRenderer";
import {TriangleDrawBinSubmitter} from "./TriangleDrawBinSubmitter";
import {WEBGPU_CLIP_SPACE_MATRIX} from "../constants";
import {RTCTileManager} from "./RTCTileManager";

const nowMs = (): number => {
  const performanceLike = (globalThis as {performance?: {now?: () => number}}).performance;
  return performanceLike?.now ? performanceLike.now() : Date.now();
};

const tempViewProjectionMatrix = createMat4Float64();
const tempWebGPUViewProjectionMatrix = createMat4Float64();
const tempSnapCropMatrix = createMat4Float64();
const tempSnapWebGPUViewProjectionMatrix = createMat4Float64();

interface ViewRenderCache {
  structureVersion: number;
  instanceDataVersion: number;
  viewStateVersion: number;
  cameraViewVersion: number;
  cameraMatrixSnapshot: number[] | null;
  hasTransparent: boolean;
  totalInstances: number;
  instanceFrame: InstanceBufferFrame | null;
  batchSet: TriangleBatchSet | null;
  batches: InstancedDrawBatches;
  snapEdgeBatches: InstancedDrawBatch[];
  meshStateByGlobalSlot: Map<number, RendererMesh>;
  knownMeshStates: Set<RendererMesh>;
  meshBaseKeys: Map<RendererMesh, string>;
  meshStateCount: number;
  builtSegmentCount: number;
  pendingSegmentCount: number;
  cullStats: RenderCullStats;
  transparentBins: TransparentRenderBinCache;
}

interface TransparentRenderBinCache {
  normalFillTransparent: DrawItem[];
  xrayedFillTransparent: DrawItem[];
  xrayedEdgesTransparent: DrawItem[];
  highlightedFillTransparent: DrawItem[];
  highlightedEdgesTransparent: DrawItem[];
  selectedFillTransparent: DrawItem[];
  selectedEdgesTransparent: DrawItem[];
}

export interface GPUPickMeshHit {
  meshState: RendererMesh;
  globalSlot: number;
}

/**
 * Owns WebGPU render pass creation and draw submission.
 *
 * @internal
 */
export class RenderManager {

  private readonly _renderContext: RenderContext;
  private readonly _bindGroupLayoutManager: BindGroupLayoutManager;
  private readonly _meshManager: MeshManager;
  private readonly _rtcTileManager: RTCTileManager;
  private readonly _frameUniformManager: FrameUniformManager;
  private readonly _instanceBufferManager: InstanceBufferManager;
  private readonly _drawOps: DrawOps;
  private readonly _pickPassRenderer: PickPassRenderer;
  private readonly _readbackBufferReader: WebGPUReadbackBufferReader;
  private readonly _timestampQueryManager: WebGPUTimestampQueryManager;
  private readonly _sectionPlaneCapRenderer: SectionPlaneCapRenderer;
  private readonly _snapPassRenderer: SnapPassRenderer;
  private readonly _triangleDrawBinSubmitter: TriangleDrawBinSubmitter;
  private readonly _renderInspector: RenderInspector;
  private readonly _bins: RenderBins = {
    normalDrawOpaque: [],
    normalEdgesOpaque: [],
    normalFillTransparent: [],
    xrayedFillOpaque: [],
    xrayedEdgesOpaque: [],
    xrayedFillTransparent: [],
    xrayedEdgesTransparent: [],
    highlightedFillOpaque: [],
    highlightedEdgesOpaque: [],
    highlightedFillTransparent: [],
    highlightedEdgesTransparent: [],
    selectedFillOpaque: [],
    selectedEdgesOpaque: [],
    selectedFillTransparent: [],
    selectedEdgesTransparent: []
  };
  private readonly _binClassifier: RenderBinClassifier;
  private readonly _instanceBatcher: InstanceBatcher;
  private readonly _viewRenderCaches: {[viewId: string]: ViewRenderCache} = {};
  private readonly _pendingSegmentPumpViews = new Set<string>();

  constructor(params: {
    renderContext: RenderContext;
    bindGroupLayoutManager: BindGroupLayoutManager;
    meshManager: MeshManager;
    rtcTileManager: RTCTileManager;
    frameUniformManager: FrameUniformManager;
    instanceBufferManager: InstanceBufferManager;
    renderInspector: RenderInspector;
  }) {
    this._renderContext = params.renderContext;
    this._bindGroupLayoutManager = params.bindGroupLayoutManager;
    this._meshManager = params.meshManager;
    this._rtcTileManager = params.rtcTileManager;
    this._frameUniformManager = params.frameUniformManager;
    this._instanceBufferManager = params.instanceBufferManager;
    this._renderInspector = params.renderInspector;
    this._binClassifier = new RenderBinClassifier(this._renderContext.memoryConfigs);
    this._drawOps = new DrawOps({
      renderContext: this._renderContext,
      bindGroupLayoutManager: this._bindGroupLayoutManager
    });
    this._readbackBufferReader = new WebGPUReadbackBufferReader(this._renderContext);
    this._timestampQueryManager = new WebGPUTimestampQueryManager(this._renderContext);
    this._pickPassRenderer = new PickPassRenderer({
      renderContext: this._renderContext,
      readbackBufferReader: this._readbackBufferReader
    });
    this._sectionPlaneCapRenderer = new SectionPlaneCapRenderer(this._renderInspector);
    this._snapPassRenderer = new SnapPassRenderer({
      renderContext: this._renderContext,
      readbackBufferReader: this._readbackBufferReader
    });
    this._triangleDrawBinSubmitter = new TriangleDrawBinSubmitter(this._renderInspector);
    this._instanceBatcher = new InstanceBatcher({
      renderContext: this._renderContext,
      bindGroupLayoutManager: this._bindGroupLayoutManager,
      rtcTileManager: this._rtcTileManager
    });
  }

  public init(): SDKResult<void> {
    return this._drawOps.init();
  }

  public getMemoryStats(): WebGPUMemoryStats {
    const triangleStats = this._instanceBatcher.getMemoryStats();
    const instanceStats = this._instanceBufferManager.getMemoryStats();
    const rtcStats = this._rtcTileManager.getMemoryStats();
    return {
      totalBytes: triangleStats.totalBytes + instanceStats.bytes + rtcStats.bytes,
      packedTrianglePages: triangleStats.pages,
      packedTriangleSegments: triangleStats.segments,
      packedTriangleBytes: triangleStats.totalBytes,
      packedTriangleVertexBytes: triangleStats.vertexBytes,
      packedTriangleVertexMetadataBytes: triangleStats.vertexMetadataBytes,
      packedTriangleIndexBytes: triangleStats.indexBytes,
      packedTriangleEdgeIndexBytes: triangleStats.edgeIndexBytes,
      packedTrianglePositionDecodeBytes: triangleStats.positionDecodeBytes,
      packedTriangleUsedVertexBytes: triangleStats.usedVertexBytes,
      packedTriangleUsedVertexMetadataBytes: triangleStats.usedVertexMetadataBytes,
      packedTriangleUsedIndexBytes: triangleStats.usedIndexBytes,
      packedTriangleUsedEdgeIndexBytes: triangleStats.usedEdgeIndexBytes,
      packedTriangleUsedPositionDecodeBytes: triangleStats.usedPositionDecodeBytes,
      packedTrianglePageDetails: triangleStats.pageDetails,
      instanceBufferBytes: instanceStats.bytes,
      instanceBufferCapacity: instanceStats.capacity,
      instanceBufferFrames: instanceStats.frames,
      rtcTileBufferBytes: rtcStats.bytes,
      rtcTileCapacity: rtcStats.capacity,
      rtcTiles: rtcStats.tiles,
      segmentsByLifecycle: triangleStats.segmentsByLifecycle,
      segmentsByMemoryPolicy: triangleStats.segmentsByMemoryPolicy
    };
  }

  public renderView(viewRenderState: ViewRenderState): SDKResult<void> {
    const view = viewRenderState.view;
    let frameStarted = false;

    try {
      const configureResult = viewRenderState.configure(this._renderContext);
      if (configureResult.ok === false) {
        return configureResult;
      }
      if (!viewRenderState.depthTextureView) {
        return {
          ok: false,
          type: SDKErrorType.InitializationFailed,
          error: `[RenderManager.renderView] View '${view.id}' depth texture was not initialized.`
        };
      }
      this._renderInspector.frameStarted(view);
      frameStarted = true;

      const backgroundColor = view.backgroundColor;
      const renderCacheResult = this._getOrBuildViewRenderCache(viewRenderState);
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
      this._reportRTCStats();
      const instanceFrame = renderCache.instanceFrame;
      if (totalInstances > 0 && !instanceFrame?.buffer) {
        return {
          ok: false,
          type: SDKErrorType.InitializationFailed,
          error: "[RenderManager.renderView] Instance buffer was not initialized."
        };
      }
      const instanceBindGroupLayoutResult = totalInstances > 0
        ? this._bindGroupLayoutManager.getInstanceBindGroupLayout()
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
      const camera = view.camera;
      mulMat4(camera.projMatrix as Mat4, camera.viewMatrix as Mat4, tempViewProjectionMatrix);
      mulMat4(WEBGPU_CLIP_SPACE_MATRIX as Mat4, tempViewProjectionMatrix, tempWebGPUViewProjectionMatrix);

      const commandEncodingStart = nowMs();
      const device = this._renderContext.device;
      const commandEncoder = device.createCommandEncoder();
      const frameAttachments = new WebGPUFrameAttachments({
        colorView: viewRenderState.context.getCurrentTexture().createView(),
        depthStencilView: viewRenderState.depthTextureView
      });
      const triangleDrawOps = this._drawOps.prims[TrianglesPrimitive];
      if (!triangleDrawOps) {
        return {
          ok: false,
          type: SDKErrorType.InitializationFailed,
          error: "[RenderManager.renderView] Triangle draw operations were not initialized."
        };
      }

      const useDepthPrepass = this._renderContext.renderConfigs.depthPrepass && renderCache.batches.opaque.length > 0;
      const timestampPassNames = this._getTimestampPassNames({
        useDepthPrepass,
        hasMainColor: (
          renderCache.batches.opaque.length > 0 ||
          renderCache.batches.edges.length > 0 ||
          totalInstances > 0 ||
          renderCache.batches.transparent.length > 0
        ),
        hasLoadedColor: totalInstances > 0 && this._getSectionPlanesForCaps(view).some((plane) => !!plane.capColor)
      });
      const timestampFrame = this._timestampQueryManager.beginFrame(timestampPassNames);

      if (useDepthPrepass) {
        const depthPrepassDescriptor = this._withTimestampWrites(
          frameAttachments.createDepthPrepassDescriptor(),
          timestampFrame,
          "DEPTH_PREPASS"
        );
        const depthPrepassEncoder = commandEncoder.beginRenderPass(depthPrepassDescriptor);
        const depthPrepassCommandState = new CommandStateTracker({
          passEncoder: depthPrepassEncoder,
          commandStats: this._renderInspector
        });
        const depthPrepassResult = this._triangleDrawBinSubmitter.drawBatchList({
          passEncoder: depthPrepassEncoder,
          commandStateTracker: depthPrepassCommandState,
          frameBindGroup: frameBindGroupResult!.value,
          instanceBindGroup: instanceBindGroupResult!.value,
          batches: renderCache.batches.opaque,
          renderPass: "DEPTH_PREPASS",
          technique: "TrianglesDepthPrepassTechnique",
          drawOp: triangleDrawOps.depthPrepass,
          missingMessage: "[RenderManager.renderView] Depth prepass triangle draw operation was not initialized."
        });
        if (depthPrepassResult.ok === false) {
          return depthPrepassResult;
        }
        this._endRenderPass(depthPrepassEncoder);
      }

      let passEncoder = commandEncoder.beginRenderPass(this._withTimestampWrites(frameAttachments.createMainColorPassDescriptor({
        clearColor: {
          r: backgroundColor[0],
          g: backgroundColor[1],
          b: backgroundColor[2],
          a: view.transparent ? 0 : 1
        },
        loadDepthStencil: useDepthPrepass
      }), timestampFrame, "MAIN_COLOR"));
      let passCommandState = new CommandStateTracker({
        passEncoder,
        commandStats: this._renderInspector
      });

      if (renderCache.batches.opaque.length > 0) {
        const drawResult = this._triangleDrawBinSubmitter.drawBatchList({
          passEncoder,
          commandStateTracker: passCommandState,
          frameBindGroup: frameBindGroupResult!.value,
          instanceBindGroup: instanceBindGroupResult!.value,
          batches: renderCache.batches.opaque,
          renderPass: "OPAQUE",
          technique: "TrianglesDrawColorTechnique",
          drawOp: triangleDrawOps.opaque,
          missingMessage: "[RenderManager.renderView] Opaque triangle draw operation was not initialized."
        });
        if (drawResult.ok === false) {
          return drawResult;
        }
      }

      if (this._renderContext.renderConfigs.edges && renderCache.batches.edges.length > 0) {
        const drawResult = this._triangleDrawBinSubmitter.drawBatchList({
          passEncoder,
          commandStateTracker: passCommandState,
          frameBindGroup: frameBindGroupResult!.value,
          instanceBindGroup: instanceBindGroupResult!.value,
          batches: renderCache.batches.edges,
          renderPass: "EDGES",
          technique: "TrianglesDrawEdgeColorTechnique",
          drawOp: triangleDrawOps.edges,
          missingMessage: "[RenderManager.renderView] Edge triangle draw operation was not initialized."
        });
        if (drawResult.ok === false) {
          return drawResult;
        }
      }

      if (totalInstances > 0) {
        const emphasizedOpaqueResult = this._triangleDrawBinSubmitter.drawEmphasisBatchLists({
          passEncoder,
          commandStateTracker: passCommandState,
          frameBindGroup: frameBindGroupResult!.value,
          instanceBindGroup: instanceBindGroupResult!.value,
          triangleDrawOps,
          batches: renderCache.batches,
          transparent: false
        });
        if (emphasizedOpaqueResult.ok === false) {
          return emphasizedOpaqueResult;
        }
      }

      const activeSectionPlanes = this._getSectionPlanesForCaps(view);
      if (totalInstances > 0 && activeSectionPlanes.some((plane) => !!plane.capColor)) {
        this._endRenderPass(passEncoder);
        const capResult = this._sectionPlaneCapRenderer.render({
          commandEncoder,
          frameAttachments,
          view,
          viewProjection: tempWebGPUViewProjectionMatrix,
          frameBindGroup: frameBindGroupResult!.value,
          instanceBindGroup: instanceBindGroupResult!.value,
          batches: this._getPickSurfaceBatches(renderCache.batches),
          triangleDrawOps,
          activePlanes: activeSectionPlanes,
          viewportWidth: viewRenderState.canvas.width,
          viewportHeight: viewRenderState.canvas.height
        });
        if (capResult.ok === false) {
          return capResult;
        }
        passEncoder = commandEncoder.beginRenderPass(this._withTimestampWrites(
          frameAttachments.createLoadedColorPassDescriptor(),
          timestampFrame,
          "LOADED_COLOR"
        ));
        passCommandState = new CommandStateTracker({
          passEncoder,
          commandStats: this._renderInspector
        });
      }

      if (renderCache.batches.transparent.length > 0) {
        const drawResult = this._triangleDrawBinSubmitter.drawBatchList({
          passEncoder,
          commandStateTracker: passCommandState,
          frameBindGroup: frameBindGroupResult!.value,
          instanceBindGroup: instanceBindGroupResult!.value,
          batches: renderCache.batches.transparent,
          renderPass: "TRANSPARENT",
          technique: "TrianglesDrawColorTechnique",
          drawOp: triangleDrawOps.transparent,
          missingMessage: "[RenderManager.renderView] Transparent triangle draw operation was not initialized."
        });
        if (drawResult.ok === false) {
          return drawResult;
        }
      }

      if (totalInstances > 0) {
        const emphasizedTransparentResult = this._triangleDrawBinSubmitter.drawEmphasisBatchLists({
          passEncoder,
          commandStateTracker: passCommandState,
          frameBindGroup: frameBindGroupResult!.value,
          instanceBindGroup: instanceBindGroupResult!.value,
          triangleDrawOps,
          batches: renderCache.batches,
          transparent: true
        });
        if (emphasizedTransparentResult.ok === false) {
          return emphasizedTransparentResult;
        }
      }

      this._endRenderPass(passEncoder);
      this._timestampQueryManager.resolveAndRead({
        frame: timestampFrame,
        commandEncoder,
        renderInspector: this._renderInspector,
        viewIndex: (view as {viewIndex?: number}).viewIndex ?? 0
      });
      this._renderInspector.addCPUTime("commandEncodingMs", nowMs() - commandEncodingStart);
      const submitStart = nowMs();
      const commandBuffer = commandEncoder.finish();
      device.queue.submit([commandBuffer]);
      this._renderInspector.addCPUTime("submitMs", nowMs() - submitStart);
      this._timestampQueryManager.readResolvedFrame({
        frame: timestampFrame,
        renderInspector: this._renderInspector,
        viewIndex: (view as {viewIndex?: number}).viewIndex ?? 0
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.Unknown,
        error: `[RenderManager.renderView] Failed to render WebGPU frame: ${e instanceof Error ? e.message : String(e)}`
      };
    } finally {
      if (frameStarted) {
        this._renderInspector.frameEnded();
      }
    }

    return {
      ok: true,
      value: undefined
    };
  }

  public async pickMeshGPUAsync(params: {
    viewRenderState: ViewRenderState;
    pickBuffer: WebGPUPickBuffer;
    canvasPos: ArrayLike<number>;
  }): Promise<SDKResult<GPUPickMeshHit | null>> {
    const view = params.viewRenderState.view;
    try {
      const configureResult = params.viewRenderState.configure(this._renderContext);
      if (configureResult.ok === false) {
        return configureResult;
      }
      const width = Math.max(1, view.boundary?.[2] || view.htmlElement?.clientWidth || 1);
      const height = Math.max(1, view.boundary?.[3] || view.htmlElement?.clientHeight || 1);
      const pickBufferResult = params.pickBuffer.ensureSize(width, height);
      if (pickBufferResult.ok === false) {
        return pickBufferResult;
      }
      if (!params.pickBuffer.colorView || !params.pickBuffer.depthView || !params.pickBuffer.colorTexture) {
        return {
          ok: false,
          type: SDKErrorType.InitializationFailed,
          error: "[RenderManager.pickMeshGPUAsync] Pick buffer was not initialized."
        };
      }

      const renderCacheResult = this._getOrBuildViewRenderCache(params.viewRenderState);
      if (renderCacheResult.ok === false) {
        return renderCacheResult;
      }
      const renderCache = renderCacheResult.value;
      const pickBatches = this._getPickSurfaceBatches(renderCache.batches);
      if (pickBatches.length === 0 || renderCache.totalInstances === 0) {
        return {
          ok: true,
          value: null
        };
      }

      const frameBindGroupResult = this._frameUniformManager.writeFrameUniforms(view);
      if (frameBindGroupResult.ok === false) {
        return frameBindGroupResult;
      }
      const instanceFrame = renderCache.instanceFrame;
      if (!instanceFrame?.buffer) {
        return {
          ok: false,
          type: SDKErrorType.InitializationFailed,
          error: "[RenderManager.pickMeshGPUAsync] Instance buffer was not initialized."
        };
      }
      const instanceBindGroupLayoutResult = this._bindGroupLayoutManager.getInstanceBindGroupLayout();
      if (instanceBindGroupLayoutResult.ok === false) {
        return instanceBindGroupLayoutResult;
      }
      const instanceBindGroupResult = this._instanceBufferManager.getBindGroup(instanceFrame, instanceBindGroupLayoutResult.value);
      if (instanceBindGroupResult.ok === false) {
        return instanceBindGroupResult;
      }

      const triangleDrawOps = this._drawOps.prims[TrianglesPrimitive];
      if (!triangleDrawOps?.pick) {
        return {
          ok: false,
          type: SDKErrorType.InitializationFailed,
          error: "[RenderManager.pickMeshGPUAsync] Triangle pick draw operation was not initialized."
        };
      }

      const encodedSlotResult = await this._pickPassRenderer.renderEncodedSlot({
        pickBuffer: params.pickBuffer,
        canvasPos: params.canvasPos,
        width,
        height,
        frameBindGroup: frameBindGroupResult.value,
        instanceBindGroup: instanceBindGroupResult.value,
        batches: pickBatches,
        drawOp: triangleDrawOps.pick
      });
      if (encodedSlotResult.ok === false) {
        return encodedSlotResult;
      }
      const encodedSlot = encodedSlotResult.value;
      if (encodedSlot === 0) {
        return {
          ok: true,
          value: null
        };
      }
      const globalSlot = encodedSlot - 1;
      const meshState = this._getMeshStateForGlobalSlot(renderCache, globalSlot);
      if (!meshState) {
        return {
          ok: true,
          value: null
        };
      }
      return {
        ok: true,
        value: {
          meshState,
          globalSlot
        }
      };
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.Unknown,
        error: `[RenderManager.pickMeshGPUAsync] Failed to run WebGPU pick pass: ${e instanceof Error ? e.message : String(e)}`
      };
    }
  }

  public async snapEdgeGPUAsync(params: {
    viewRenderState: ViewRenderState;
    snapBuffer: WebGPUSnapBuffer;
    canvasPos: ArrayLike<number>;
  }): Promise<SDKResult<GPUPickMeshHit | null>> {
    const view = params.viewRenderState.view;
    try {
      const configureResult = params.viewRenderState.configure(this._renderContext);
      if (configureResult.ok === false) {
        return configureResult;
      }
      if (!params.snapBuffer.colorView || !params.snapBuffer.depthView || !params.snapBuffer.colorTexture) {
        return {
          ok: false,
          type: SDKErrorType.InitializationFailed,
          error: "[RenderManager.snapEdgeGPUAsync] Snap buffer was not initialized."
        };
      }

      const renderCacheResult = this._getOrBuildViewRenderCache(params.viewRenderState);
      if (renderCacheResult.ok === false) {
        return renderCacheResult;
      }
      const renderCache = renderCacheResult.value;
      if (renderCache.snapEdgeBatches.length === 0 || renderCache.totalInstances === 0) {
        return {
          ok: true,
          value: null
        };
      }

      return this._snapCandidateGPUAsync({
        view,
        snapBuffer: params.snapBuffer,
        canvasPos: params.canvasPos,
        renderCache,
        candidateBatches: renderCache.snapEdgeBatches,
        drawOpName: "snapEdge",
        errorPrefix: "RenderManager.snapEdgeGPUAsync"
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.Unknown,
        error: `[RenderManager.snapEdgeGPUAsync] Failed to run WebGPU edge snap pass: ${e instanceof Error ? e.message : String(e)}`
      };
    }
  }

  public async snapVertexGPUAsync(params: {
    viewRenderState: ViewRenderState;
    snapBuffer: WebGPUSnapBuffer;
    canvasPos: ArrayLike<number>;
  }): Promise<SDKResult<GPUPickMeshHit | null>> {
    const view = params.viewRenderState.view;
    try {
      const configureResult = params.viewRenderState.configure(this._renderContext);
      if (configureResult.ok === false) {
        return configureResult;
      }
      if (!params.snapBuffer.colorView || !params.snapBuffer.depthView || !params.snapBuffer.colorTexture) {
        return {
          ok: false,
          type: SDKErrorType.InitializationFailed,
          error: "[RenderManager.snapVertexGPUAsync] Snap buffer was not initialized."
        };
      }

      const renderCacheResult = this._getOrBuildViewRenderCache(params.viewRenderState);
      if (renderCacheResult.ok === false) {
        return renderCacheResult;
      }
      const renderCache = renderCacheResult.value;
      const candidateBatches = this._getPickSurfaceBatches(renderCache.batches);
      if (candidateBatches.length === 0 || renderCache.totalInstances === 0) {
        return {
          ok: true,
          value: null
        };
      }

      const snapViewProjectionMatrix = this._getSnapWebGPUViewProjectionMatrix(view, params.canvasPos, params.snapBuffer);
      return this._snapCandidateGPUAsync({
        view,
        snapBuffer: params.snapBuffer,
        canvasPos: params.canvasPos,
        renderCache,
        candidateBatches,
        drawOpName: "snapVertex",
        errorPrefix: "RenderManager.snapVertexGPUAsync",
        snapViewProjectionMatrix
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.Unknown,
        error: `[RenderManager.snapVertexGPUAsync] Failed to run WebGPU vertex snap pass: ${e instanceof Error ? e.message : String(e)}`
      };
    }
  }

  private async _snapCandidateGPUAsync(params: {
    view: View;
    snapBuffer: WebGPUSnapBuffer;
    canvasPos: ArrayLike<number>;
    renderCache: ViewRenderCache;
    candidateBatches: InstancedDrawBatch[];
    drawOpName: "snapVertex" | "snapEdge";
    errorPrefix: string;
    snapViewProjectionMatrix?: Mat4;
  }): Promise<SDKResult<GPUPickMeshHit | null>> {
    try {
      const view = params.view;
      const renderCache = params.renderCache;
      const snapViewProjectionMatrix = params.snapViewProjectionMatrix ??
        this._getSnapWebGPUViewProjectionMatrix(view, params.canvasPos, params.snapBuffer);
      const frameBindGroupResult = this._frameUniformManager.writeFrameUniformsForWebGPUViewProjection(view, snapViewProjectionMatrix);
      if (frameBindGroupResult.ok === false) {
        return frameBindGroupResult;
      }
      const instanceFrame = renderCache.instanceFrame;
      if (!instanceFrame?.buffer) {
        return {
          ok: false,
          type: SDKErrorType.InitializationFailed,
          error: `[${params.errorPrefix}] Instance buffer was not initialized.`
        };
      }
      const instanceBindGroupLayoutResult = this._bindGroupLayoutManager.getInstanceBindGroupLayout();
      if (instanceBindGroupLayoutResult.ok === false) {
        return instanceBindGroupLayoutResult;
      }
      const instanceBindGroupResult = this._instanceBufferManager.getBindGroup(instanceFrame, instanceBindGroupLayoutResult.value);
      if (instanceBindGroupResult.ok === false) {
        return instanceBindGroupResult;
      }

      const triangleDrawOps = this._drawOps.prims[TrianglesPrimitive];
      const candidateDrawOp = triangleDrawOps?.[params.drawOpName];
      if (!candidateDrawOp) {
        return {
          ok: false,
          type: SDKErrorType.InitializationFailed,
          error: `[${params.errorPrefix}] Triangle snap draw operation was not initialized.`
        };
      }
      if (!triangleDrawOps?.pick) {
        return {
          ok: false,
          type: SDKErrorType.InitializationFailed,
          error: `[${params.errorPrefix}] Triangle depth prepass draw operation was not initialized.`
        };
      }

      const encodedSlotResult = await this._snapPassRenderer.renderEncodedSlot({
        snapBuffer: params.snapBuffer,
        frameBindGroup: frameBindGroupResult.value,
        instanceBindGroup: instanceBindGroupResult.value,
        depthPrepassBatches: renderCache.batches.opaque,
        candidateBatches: params.candidateBatches,
        depthPrepassDrawOp: triangleDrawOps.pick,
        candidateDrawOp,
        errorPrefix: params.errorPrefix
      });
      if (encodedSlotResult.ok === false) {
        return encodedSlotResult;
      }
      const encodedSlot = encodedSlotResult.value;
      if (encodedSlot === 0) {
        return {
          ok: true,
          value: null
        };
      }
      const globalSlot = encodedSlot - 1;
      const meshState = this._getMeshStateForGlobalSlot(renderCache, globalSlot);
      if (!meshState) {
        return {
          ok: true,
          value: null
        };
      }
      return {
        ok: true,
        value: {
          meshState,
          globalSlot
        }
      };
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.Unknown,
        error: `[${params.errorPrefix}] Failed to run WebGPU snap pass: ${e instanceof Error ? e.message : String(e)}`
      };
    }
  }

  public destroy(): void {
    this._pendingSegmentPumpViews.clear();
    for (const viewId of Object.keys(this._viewRenderCaches)) {
      this.viewDestroyed(viewId);
    }
    this._instanceBatcher.destroy();
    this._drawOps.destroy();
    this._instanceBufferManager.destroy();
    this._rtcTileManager.destroy();
    this._frameUniformManager.destroy();
  }

  public viewDestroyed(viewId: string): void {
    this._pendingSegmentPumpViews.delete(viewId);
    const cache = this._viewRenderCaches[viewId];
    if (cache) {
      this._clearCachedBatches(cache.batches);
      this._clearBatchList(cache.snapEdgeBatches);
    }
    delete this._viewRenderCaches[viewId];
    this._instanceBufferManager.destroyFrame(viewId);
  }

  private _getTimestampPassNames(params: {
    useDepthPrepass: boolean;
    hasMainColor: boolean;
    hasLoadedColor: boolean;
  }): string[] {
    if (!this._renderInspector.active) {
      return [];
    }
    const passNames: string[] = [];
    if (params.useDepthPrepass) {
      passNames.push("DEPTH_PREPASS");
    }
    if (params.hasMainColor) {
      passNames.push("MAIN_COLOR");
    }
    if (params.hasLoadedColor) {
      passNames.push("LOADED_COLOR");
    }
    return passNames;
  }

  private _withTimestampWrites(descriptor: unknown, timestampFrame: WebGPUTimestampFrame | null, passName: string): unknown {
    const timestampWrites = this._timestampQueryManager.createTimestampWrites(timestampFrame, passName);
    if (!timestampWrites) {
      return descriptor;
    }
    return {
      ...(descriptor as object),
      timestampWrites
    };
  }

  private _endRenderPass(passEncoder: WebGPURenderPassEncoderLike): void {
    if (typeof passEncoder.end === "function") {
      passEncoder.end();
      return;
    }
    passEncoder.endPass?.();
  }

  private _reportRTCStats(): void {
    const stats = this._rtcTileManager.getStats();
    this._renderInspector.setRTCStats({
      tiles: stats.tiles,
      tileMatrixUploads: stats.tileMatrixUploads,
      meshesWithRTCTile: stats.meshesWithRTCTile,
      meshesUsingFallback: stats.meshesUsingFallback
    });
  }

  private _getSnapWebGPUViewProjectionMatrix(
    view: View,
    canvasPos: ArrayLike<number>,
    snapBuffer: WebGPUSnapBuffer
  ): Mat4 {
    const camera = view.camera;
    const viewMatrix = camera.viewMatrix as Mat4;
    const projMatrix = camera.projMatrix as Mat4;
    const boundary = view.boundary ?? [0, 0, view.htmlElement?.clientWidth ?? 1, view.htmlElement?.clientHeight ?? 1];
    const width = Math.max(1, boundary[2] || 1);
    const height = Math.max(1, boundary[3] || 1);
    const dimension = snapBuffer.dimension;
    const originX = Math.floor(canvasPos[0]) - snapBuffer.snapRadius;
    const originY = Math.floor(canvasPos[1]) - snapBuffer.snapRadius;
    const sx = width / dimension;
    const sy = height / dimension;
    const tx = ((width - 2 * originX) / dimension) - 1;
    const ty = 1 - ((height - 2 * originY) / dimension);

    tempSnapCropMatrix[0] = sx;
    tempSnapCropMatrix[1] = 0;
    tempSnapCropMatrix[2] = 0;
    tempSnapCropMatrix[3] = 0;
    tempSnapCropMatrix[4] = 0;
    tempSnapCropMatrix[5] = sy;
    tempSnapCropMatrix[6] = 0;
    tempSnapCropMatrix[7] = 0;
    tempSnapCropMatrix[8] = 0;
    tempSnapCropMatrix[9] = 0;
    tempSnapCropMatrix[10] = 1;
    tempSnapCropMatrix[11] = 0;
    tempSnapCropMatrix[12] = tx;
    tempSnapCropMatrix[13] = ty;
    tempSnapCropMatrix[14] = 0;
    tempSnapCropMatrix[15] = 1;

    mulMat4(projMatrix, viewMatrix, tempViewProjectionMatrix);
    mulMat4(WEBGPU_CLIP_SPACE_MATRIX as Mat4, tempViewProjectionMatrix, tempWebGPUViewProjectionMatrix);
    mulMat4(tempSnapCropMatrix, tempWebGPUViewProjectionMatrix, tempSnapWebGPUViewProjectionMatrix);
    return tempSnapWebGPUViewProjectionMatrix;
  }

  private _getMeshStateForGlobalSlot(cache: ViewRenderCache, globalSlot: number): RendererMesh | null {
    return cache.meshStateByGlobalSlot.get(globalSlot) ?? null;
  }

  private _getOrBuildViewRenderCache(viewRenderState: ViewRenderState): SDKResult<ViewRenderCache> {
    const view = viewRenderState.view;
    const cache = this._getViewRenderCache(view.id);
    const structureVersion = this._meshManager.structureVersion;
    const instanceDataVersion = this._meshManager.instanceDataVersion;
    const viewStateVersion = this._meshManager.getViewStateVersion(view);
    const cameraViewVersion = this._meshManager.getCameraViewVersion(view);
    const cameraMatrixChanged = cache.cameraViewVersion !== cameraViewVersion && !this._isCameraMatrixUnchanged(cache, view);
    const needsFullRebuild =
      cache.structureVersion !== structureVersion ||
      cache.instanceDataVersion !== instanceDataVersion ||
      cache.viewStateVersion !== viewStateVersion ||
      (this._usesCameraCulling() && cameraMatrixChanged) ||
      (cache.totalInstances > 0 && !cache.instanceFrame?.buffer);
    const needsTransparentSort =
      cache.hasTransparent &&
      cameraMatrixChanged;

    if (!needsFullRebuild) {
      if (needsTransparentSort) {
        return this._rebuildTransparentViewRenderCache({
          cache,
          viewRenderState,
          structureVersion,
          instanceDataVersion,
          viewStateVersion,
          cameraViewVersion
        });
      }
      this._renderInspector.setSegmentQueueStats({
        built: cache.builtSegmentCount,
        pending: cache.pendingSegmentCount,
        buildTelemetry: cache.batchSet?.buildTelemetry
      });
      this._renderInspector.setCullStats(cache.cullStats);
      if (cache.cameraViewVersion !== cameraViewVersion) {
        cache.cameraViewVersion = cameraViewVersion;
        this._rememberCameraMatrix(cache, view);
      }
      this._renderInspector.setRenderReason(cameraMatrixChanged ? "cameraOnlyReuse" : "cacheReuse");
      return {
        ok: true,
        value: cache
      };
    }

    if (
      !this._usesCameraCulling() &&
      cache.pendingSegmentCount > 0 &&
      cache.batchSet?.structureVersion === structureVersion &&
      cache.instanceDataVersion === instanceDataVersion &&
      cache.viewStateVersion === viewStateVersion &&
      !cache.hasTransparent &&
      cache.instanceFrame?.buffer
    ) {
      const pendingAppendResult = this._tryAppendPendingSegmentsViewRenderCache({
        cache,
        viewRenderState,
        structureVersion,
        instanceDataVersion,
        viewStateVersion,
        cameraViewVersion
      });
      if (pendingAppendResult) {
        return pendingAppendResult;
      }
    }

    if (
      !this._usesCameraCulling() &&
      cache.pendingSegmentCount === 0 &&
      cache.structureVersion >= 0 &&
      cache.structureVersion !== structureVersion &&
      cache.viewStateVersion === viewStateVersion &&
      !cache.hasTransparent &&
      cache.instanceFrame?.buffer
    ) {
      const appendOnlyResult = this._tryAppendOnlyViewRenderCache({
        cache,
        viewRenderState,
        structureVersion,
        instanceDataVersion,
        viewStateVersion,
        cameraViewVersion
      });
      if (appendOnlyResult) {
        return appendOnlyResult;
      }
    }

    const batchingStart = nowMs();
    const renderReason = this._getFullRebuildReason({
      cache,
      structureVersion,
      instanceDataVersion,
      viewStateVersion,
      cameraMatrixChanged
    });
    const prepareStart = nowMs();
    const batchSetResult = this._instanceBatcher.prepareBatchSet(this._meshManager, this._getRenderFrameBatchPrepareOptions());
    if (batchSetResult.ok === false) {
      return batchSetResult;
    }
    this._renderInspector.addCPUTime("prepareMs", nowMs() - prepareStart);
    const batchSet = batchSetResult.value;
    this._renderInspector.setSegmentQueueStats({
      built: batchSet.builtSegmentCount,
      pending: batchSet.pendingSegmentCount,
      buildTelemetry: batchSet.buildTelemetry
    });

    const meshStates = this._meshManager.meshStates;
    const binningStart = nowMs();
    this._binClassifier.clear(this._bins);
    this._binClassifier.classifySegments({
      batchSet,
      view,
      meshManager: this._meshManager,
      bins: this._bins,
      cameraCulling: this._usesCameraCulling()
    });
    this._renderInspector.addCPUTime("binningMs", nowMs() - binningStart);
    cache.cullStats = cloneCullStats(this._binClassifier.stats);

    const totalSceneInstances = this._countVisibleDrawItems(this._bins);
    if (totalSceneInstances === 0 || batchSet.instanceCapacity === 0) {
      this._clearCachedBatches(cache.batches);
      cache.instanceFrame = null;
      cache.batchSet = batchSet;
      cache.totalInstances = 0;
      cache.hasTransparent = false;
      cache.structureVersion = batchSet.pendingSegmentCount > 0 ? -1 : structureVersion;
      cache.instanceDataVersion = instanceDataVersion;
      cache.viewStateVersion = viewStateVersion;
      cache.cameraViewVersion = cameraViewVersion;
      this._rememberCameraMatrix(cache, view);
      cache.builtSegmentCount = batchSet.builtSegmentCount;
      cache.pendingSegmentCount = batchSet.pendingSegmentCount;
      this._renderInspector.setCullStats(cache.cullStats);
      this._renderInspector.setRenderReason("empty");
      this._instanceBufferManager.destroyFrame(view.id);
      this._clearBatchList(cache.snapEdgeBatches);
      clearTransparentRenderBinCache(cache.transparentBins);
      this._rememberMeshSlots(cache, batchSet);
      this._rememberMeshStates(cache, meshStates);
      this._requestPendingSegmentFrame(view, batchSet);
      return {
        ok: true,
        value: cache
      };
    }

    const instanceFrameResult = this._instanceBufferManager.beginFrame(this._getInstanceFrameCapacity(batchSet), view.id);
    if (instanceFrameResult.ok === false) {
      return instanceFrameResult;
    }
    cache.instanceFrame = instanceFrameResult.value;

    const drawBatchStart = nowMs();
    const drawBatchesResult = this._instanceBatcher.buildPrepared({
      batchSet,
      bins: this._bins,
      view,
      meshManager: this._meshManager,
      instanceFrame: cache.instanceFrame,
      includeEdges: this._renderContext.renderConfigs.edges
    });
    if (drawBatchesResult.ok === false) {
      return drawBatchesResult;
    }
    const uploadStart = nowMs();
    this._renderInspector.setInstanceUploadStats(this._instanceBufferManager.upload(cache.instanceFrame));
    this._renderInspector.addCPUTime("uploadMs", nowMs() - uploadStart);
    this._copyBatches(drawBatchesResult.value, cache.batches);
    const snapEdgeBatchesResult = this._instanceBatcher.buildEdges({
      batchSet,
      drawItems: this._getEdgeSnapDrawItems(this._bins),
      viewId: `${view.id}:snap-edge`
    });
    if (snapEdgeBatchesResult.ok === false) {
      return snapEdgeBatchesResult;
    }
    this._replaceSnapEdgeBatches(cache, snapEdgeBatchesResult.value);
    this._renderInspector.addCPUTime("drawBatchMs", nowMs() - drawBatchStart);
    this._renderInspector.addCPUTime("batchingMs", nowMs() - batchingStart);
    this._renderInspector.addSegments(this._countBatches(cache.batches));
    cache.batchSet = batchSet;
    cache.totalInstances = batchSet.instanceCapacity;
    cache.hasTransparent = this._hasTransparentDrawItems(this._bins);
    this._rememberTransparentBins(cache, this._bins);
    cache.structureVersion = batchSet.pendingSegmentCount > 0 ? -1 : structureVersion;
    cache.instanceDataVersion = instanceDataVersion;
    cache.viewStateVersion = viewStateVersion;
    cache.cameraViewVersion = cameraViewVersion;
    this._rememberCameraMatrix(cache, view);
    cache.builtSegmentCount = batchSet.builtSegmentCount;
    cache.pendingSegmentCount = batchSet.pendingSegmentCount;
    this._renderInspector.setCullStats(cache.cullStats);
    this._renderInspector.setRenderReason(renderReason);
    this._rememberMeshSlots(cache, batchSet);
    this._rememberMeshStates(cache, meshStates);
    this._requestPendingSegmentFrame(view, batchSet);

    return {
      ok: true,
      value: cache
    };
  }

  private _tryAppendOnlyViewRenderCache(params: {
    cache: ViewRenderCache;
    viewRenderState: ViewRenderState;
    structureVersion: number;
    instanceDataVersion: number;
    viewStateVersion: number;
    cameraViewVersion: number;
  }): SDKResult<ViewRenderCache> | null {
    const {cache, viewRenderState} = params;
    const view = viewRenderState.view;
    const meshStates = this._meshManager.meshStates;
    if (meshStates.length <= cache.meshStateCount || cache.knownMeshStates.size === 0) {
      return null;
    }

    const currentMeshStates = new Set(meshStates);
    for (const meshState of cache.knownMeshStates) {
      if (!currentMeshStates.has(meshState)) {
        return null;
      }
      if (cache.meshBaseKeys.get(meshState) !== this._getMeshBaseKey(meshState)) {
        return null;
      }
    }

    const newMeshStates: RendererMesh[] = [];
    for (let i = 0, len = meshStates.length; i < len; i++) {
      const meshState = meshStates[i];
      if (!cache.knownMeshStates.has(meshState)) {
        newMeshStates.push(meshState);
      }
    }
    if (newMeshStates.length === 0) {
      return null;
    }

    const binningStart = nowMs();
    this._binClassifier.clear(this._bins);
    this._binClassifier.classify({
      meshStates: newMeshStates,
      view,
      meshManager: this._meshManager,
      bins: this._bins
    });
    this._renderInspector.addCPUTime("binningMs", nowMs() - binningStart);
    const newCullStats = cloneCullStats(this._binClassifier.stats);
    if (this._hasTransparentDrawItems(this._bins) || this._hasEmphasisDrawItems(this._bins)) {
      return null;
    }

    const batchingStart = nowMs();
    const prepareStart = nowMs();
    const previousBatchSet = cache.batchSet;
    const batchSetResult = this._instanceBatcher.prepareBatchSet(this._meshManager, this._getRenderFrameBatchPrepareOptions());
    if (batchSetResult.ok === false) {
      return batchSetResult;
    }
    const previousSegmentKeys = new Set(previousBatchSet?.segments.map((segment) => segment.key) ?? []);
    const newSegments = batchSetResult.value.segments.filter((segment) => !previousSegmentKeys.has(segment.key));
    this._renderInspector.addCPUTime("prepareMs", nowMs() - prepareStart);
    this._renderInspector.setSegmentQueueStats({
      built: batchSetResult.value.builtSegmentCount,
      pending: batchSetResult.value.pendingSegmentCount,
      buildTelemetry: batchSetResult.value.buildTelemetry
    });
    const instanceFrameResult = this._instanceBufferManager.beginFrame(this._getInstanceFrameCapacity(batchSetResult.value), view.id);
    if (instanceFrameResult.ok === false) {
      return instanceFrameResult;
    }
    cache.instanceFrame = instanceFrameResult.value;
    cache.batchSet = batchSetResult.value;
    const drawBatchStart = nowMs();
    this._instanceBatcher.writeInstances({
      batchSet: batchSetResult.value,
      segments: newSegments,
      view,
      meshManager: this._meshManager,
      instanceFrame: cache.instanceFrame
    });

    const opaqueBatchesResult = this._instanceBatcher.buildOpaque({
      batchSet: batchSetResult.value,
      drawItems: this._bins.normalDrawOpaque,
      viewId: view.id
    });
    if (opaqueBatchesResult.ok === false) {
      return opaqueBatchesResult;
    }
    for (let i = 0, len = opaqueBatchesResult.value.length; i < len; i++) {
      cache.batches.opaque.push(opaqueBatchesResult.value[i]);
    }
    if (this._renderContext.renderConfigs.edges) {
      const edgeBatchesResult = this._instanceBatcher.buildEdges({
        batchSet: batchSetResult.value,
        drawItems: this._bins.normalEdgesOpaque,
        viewId: view.id
      });
      if (edgeBatchesResult.ok === false) {
        return edgeBatchesResult;
      }
      for (let i = 0, len = edgeBatchesResult.value.length; i < len; i++) {
        cache.batches.edges.push(edgeBatchesResult.value[i]);
      }
    }
    const snapEdgeBatchesResult = this._instanceBatcher.buildEdges({
      batchSet: batchSetResult.value,
      drawItems: this._getEdgeSnapDrawItems(this._bins),
      viewId: `${view.id}:snap-edge`
    });
    if (snapEdgeBatchesResult.ok === false) {
      return snapEdgeBatchesResult;
    }
    for (let i = 0, len = snapEdgeBatchesResult.value.length; i < len; i++) {
      cache.snapEdgeBatches.push(snapEdgeBatchesResult.value[i]);
    }

    this._renderInspector.addCPUTime("drawBatchMs", nowMs() - drawBatchStart);
    this._renderInspector.addCPUTime("batchingMs", nowMs() - batchingStart);
    const uploadStart = nowMs();
    this._renderInspector.setInstanceUploadStats(this._instanceBufferManager.upload(cache.instanceFrame));
    this._renderInspector.addCPUTime("uploadMs", nowMs() - uploadStart);
    this._renderInspector.addSegments(this._countBatches(cache.batches));
    cache.cullStats = addCullStats(cache.cullStats, newCullStats);
    this._renderInspector.setCullStats(cache.cullStats);
    this._renderInspector.setRenderReason("appendOnlyStructureUpdate");

    cache.totalInstances += this._bins.normalDrawOpaque.length;
    cache.hasTransparent = false;
    cache.structureVersion = batchSetResult.value.pendingSegmentCount > 0 ? -1 : params.structureVersion;
    cache.instanceDataVersion = params.instanceDataVersion;
    cache.viewStateVersion = params.viewStateVersion;
    cache.cameraViewVersion = params.cameraViewVersion;
    this._rememberCameraMatrix(cache, view);
    cache.builtSegmentCount = batchSetResult.value.builtSegmentCount;
    cache.pendingSegmentCount = batchSetResult.value.pendingSegmentCount;
    this._rememberMeshSlots(cache, batchSetResult.value);
    this._rememberMeshStates(cache, meshStates);
    this._requestPendingSegmentFrame(view, batchSetResult.value);

    return {
      ok: true,
      value: cache
    };
  }

  private _tryAppendPendingSegmentsViewRenderCache(params: {
    cache: ViewRenderCache;
    viewRenderState: ViewRenderState;
    structureVersion: number;
    instanceDataVersion: number;
    viewStateVersion: number;
    cameraViewVersion: number;
  }): SDKResult<ViewRenderCache> | null {
    const {cache, viewRenderState} = params;
    const view = viewRenderState.view;
    const previousBatchSet = cache.batchSet;
    if (!previousBatchSet) {
      return null;
    }

    const batchingStart = nowMs();
    const prepareStart = nowMs();
    const batchSetResult = this._instanceBatcher.prepareBatchSet(this._meshManager, this._getRenderFrameBatchPrepareOptions());
    if (batchSetResult.ok === false) {
      return batchSetResult;
    }
    this._renderInspector.addCPUTime("prepareMs", nowMs() - prepareStart);
    const batchSet = batchSetResult.value;
    this._renderInspector.setSegmentQueueStats({
      built: batchSet.builtSegmentCount,
      pending: batchSet.pendingSegmentCount,
      buildTelemetry: batchSet.buildTelemetry
    });

    const previousSegmentKeys = new Set(previousBatchSet.segments.map((segment) => segment.key));
    const newSegments = batchSet.segments.filter((segment) => !previousSegmentKeys.has(segment.key));
    if (newSegments.length === 0) {
      cache.batchSet = batchSet;
      cache.structureVersion = batchSet.pendingSegmentCount > 0 ? -1 : params.structureVersion;
      cache.instanceDataVersion = params.instanceDataVersion;
      cache.viewStateVersion = params.viewStateVersion;
      cache.cameraViewVersion = params.cameraViewVersion;
      cache.builtSegmentCount = batchSet.builtSegmentCount;
      cache.pendingSegmentCount = batchSet.pendingSegmentCount;
      this._rememberCameraMatrix(cache, view);
      this._renderInspector.setCullStats(cache.cullStats);
      this._renderInspector.setRenderReason("pendingSegmentAppend");
      this._requestPendingSegmentFrame(view, batchSet);
      return {
        ok: true,
        value: cache
      };
    }

    const partialBatchSet: TriangleBatchSet = {
      structureVersion: batchSet.structureVersion,
      instanceCapacity: batchSet.instanceCapacity,
      projectedInstanceCapacity: batchSet.projectedInstanceCapacity,
      segments: newSegments,
      segmentByMeshId: batchSet.segmentByMeshId,
      pendingSegmentCount: batchSet.pendingSegmentCount,
      builtSegmentCount: newSegments.length,
      buildTelemetry: batchSet.buildTelemetry
    };

    const binningStart = nowMs();
    this._binClassifier.clear(this._bins);
    this._binClassifier.classifySegments({
      batchSet: partialBatchSet,
      view,
      meshManager: this._meshManager,
      bins: this._bins,
      cameraCulling: false
    });
    this._renderInspector.addCPUTime("binningMs", nowMs() - binningStart);
    const newCullStats = cloneCullStats(this._binClassifier.stats);
    if (this._hasTransparentDrawItems(this._bins) || this._hasEmphasisDrawItems(this._bins)) {
      return null;
    }

    const instanceFrameResult = this._instanceBufferManager.beginFrame(this._getInstanceFrameCapacity(batchSet), view.id);
    if (instanceFrameResult.ok === false) {
      return instanceFrameResult;
    }
    cache.instanceFrame = instanceFrameResult.value;
    cache.batchSet = batchSet;

    const drawBatchStart = nowMs();
    this._instanceBatcher.writeInstances({
      batchSet,
      segments: newSegments,
      view,
      meshManager: this._meshManager,
      instanceFrame: cache.instanceFrame
    });

    const opaqueBatchesResult = this._instanceBatcher.buildOpaque({
      batchSet: partialBatchSet,
      drawItems: this._bins.normalDrawOpaque,
      viewId: view.id
    });
    if (opaqueBatchesResult.ok === false) {
      return opaqueBatchesResult;
    }
    for (let i = 0, len = opaqueBatchesResult.value.length; i < len; i++) {
      cache.batches.opaque.push(opaqueBatchesResult.value[i]);
    }

    if (this._renderContext.renderConfigs.edges) {
      const edgeBatchesResult = this._instanceBatcher.buildEdges({
        batchSet: partialBatchSet,
        drawItems: this._bins.normalEdgesOpaque,
        viewId: view.id
      });
      if (edgeBatchesResult.ok === false) {
        return edgeBatchesResult;
      }
      for (let i = 0, len = edgeBatchesResult.value.length; i < len; i++) {
        cache.batches.edges.push(edgeBatchesResult.value[i]);
      }
    }

    const snapEdgeBatchesResult = this._instanceBatcher.buildEdges({
      batchSet: partialBatchSet,
      drawItems: this._getEdgeSnapDrawItems(this._bins),
      viewId: `${view.id}:snap-edge`
    });
    if (snapEdgeBatchesResult.ok === false) {
      return snapEdgeBatchesResult;
    }
    for (let i = 0, len = snapEdgeBatchesResult.value.length; i < len; i++) {
      cache.snapEdgeBatches.push(snapEdgeBatchesResult.value[i]);
    }

    this._renderInspector.addCPUTime("drawBatchMs", nowMs() - drawBatchStart);
    this._renderInspector.addCPUTime("batchingMs", nowMs() - batchingStart);
    const uploadStart = nowMs();
    this._renderInspector.setInstanceUploadStats(this._instanceBufferManager.upload(cache.instanceFrame));
    this._renderInspector.addCPUTime("uploadMs", nowMs() - uploadStart);
    this._renderInspector.addSegments(this._countBatches(cache.batches));
    cache.cullStats = addCullStats(cache.cullStats, newCullStats);
    this._renderInspector.setCullStats(cache.cullStats);
    this._renderInspector.setRenderReason("pendingSegmentAppend");

    cache.totalInstances = batchSet.instanceCapacity;
    cache.hasTransparent = false;
    cache.structureVersion = batchSet.pendingSegmentCount > 0 ? -1 : params.structureVersion;
    cache.instanceDataVersion = params.instanceDataVersion;
    cache.viewStateVersion = params.viewStateVersion;
    cache.cameraViewVersion = params.cameraViewVersion;
    this._rememberCameraMatrix(cache, view);
    cache.builtSegmentCount = batchSet.builtSegmentCount;
    cache.pendingSegmentCount = batchSet.pendingSegmentCount;
    this._rememberMeshSlotsForSegments(cache, newSegments);
    this._requestPendingSegmentFrame(view, batchSet);

    return {
      ok: true,
      value: cache
    };
  }

  private _rebuildTransparentViewRenderCache(params: {
    cache: ViewRenderCache;
    viewRenderState: ViewRenderState;
    structureVersion: number;
    instanceDataVersion: number;
    viewStateVersion: number;
    cameraViewVersion: number;
  }): SDKResult<ViewRenderCache> {
    const {cache, viewRenderState} = params;
    const view = viewRenderState.view;

    const batchingStart = nowMs();
    let batchSet = cache.batchSet;
    if (!batchSet) {
      const prepareStart = nowMs();
      const batchSetResult = this._instanceBatcher.prepareBatchSet(this._meshManager, this._getRenderFrameBatchPrepareOptions());
      if (batchSetResult.ok === false) {
        return batchSetResult;
      }
      this._renderInspector.addCPUTime("prepareMs", nowMs() - prepareStart);
      batchSet = batchSetResult.value;
      cache.batchSet = batchSet;
    }
    this._renderInspector.setSegmentQueueStats({
      built: batchSet.builtSegmentCount,
      pending: batchSet.pendingSegmentCount,
      buildTelemetry: batchSet.buildTelemetry
    });

    const canReuseSegmentBatches = this._renderContext.renderConfigs.transparentSortStrategy === "segment" && this._hasTransparentBatches(cache.batches);
    const binningStart = nowMs();
    if (canReuseSegmentBatches) {
      this._restoreTransparentSegmentBins(cache, view, batchSet);
    } else {
      this._restoreTransparentBins(cache, view);
    }
    this._renderInspector.addCPUTime("binningMs", nowMs() - binningStart);

    const drawBatchStart = nowMs();
    if (canReuseSegmentBatches) {
      this._sortCachedTransparentSegmentBatches(cache, batchSet);
      this._renderInspector.addCPUTime("drawBatchMs", nowMs() - drawBatchStart);
      this._renderInspector.addCPUTime("batchingMs", nowMs() - batchingStart);
      this._renderInspector.addSegments(this._countBatches(cache.batches));
      this._renderInspector.setCullStats(cache.cullStats);
      this._renderInspector.setRenderReason("transparentSegmentBatch");
      cache.hasTransparent = true;
      cache.structureVersion = params.structureVersion;
      cache.instanceDataVersion = params.instanceDataVersion;
      cache.viewStateVersion = params.viewStateVersion;
      cache.cameraViewVersion = params.cameraViewVersion;
      this._rememberCameraMatrix(cache, view);
      return {
        ok: true,
        value: cache
      };
    }

    const transparentBatchesResult = this._instanceBatcher.buildTransparentPrepared({
      batchSet,
      bins: this._bins,
      view,
      includeEdges: this._renderContext.renderConfigs.edges
    });
    if (transparentBatchesResult.ok === false) {
      return transparentBatchesResult;
    }

    this._replaceBatches(transparentBatchesResult.value.transparent, cache.batches.transparent);
    this._replaceBatches(transparentBatchesResult.value.xrayedTransparent, cache.batches.xrayedTransparent);
    this._replaceBatches(transparentBatchesResult.value.xrayedEdgesTransparent, cache.batches.xrayedEdgesTransparent);
    this._replaceBatches(transparentBatchesResult.value.highlightedTransparent, cache.batches.highlightedTransparent);
    this._replaceBatches(transparentBatchesResult.value.highlightedEdgesTransparent, cache.batches.highlightedEdgesTransparent);
    this._replaceBatches(transparentBatchesResult.value.selectedTransparent, cache.batches.selectedTransparent);
    this._replaceBatches(transparentBatchesResult.value.selectedEdgesTransparent, cache.batches.selectedEdgesTransparent);
    transparentBatchesResult.value.opaque.length = 0;
    transparentBatchesResult.value.edges.length = 0;
    this._renderInspector.addCPUTime("drawBatchMs", nowMs() - drawBatchStart);
    this._renderInspector.addCPUTime("batchingMs", nowMs() - batchingStart);
    this._renderInspector.addSegments(this._countBatches(cache.batches));
    this._renderInspector.setCullStats(cache.cullStats);
    this._renderInspector.setRenderReason(
      this._renderContext.renderConfigs.transparentSortStrategy === "object"
        ? "transparentSort"
        : "transparentSegmentBatch"
    );
    cache.hasTransparent = this._hasTransparentBatches(cache.batches);
    cache.structureVersion = params.structureVersion;
    cache.instanceDataVersion = params.instanceDataVersion;
    cache.viewStateVersion = params.viewStateVersion;
    cache.cameraViewVersion = params.cameraViewVersion;
    this._rememberCameraMatrix(cache, view);

    return {
      ok: true,
      value: cache
    };
  }

  private _requestPendingSegmentFrame(view: View, batchSet: TriangleBatchSet): void {
    if (batchSet.pendingSegmentCount > 0) {
      if (this._usesBackgroundPendingSegmentPump()) {
        this._schedulePendingSegmentPump(view);
      } else {
        view.needsRender();
        globalThis.requestAnimationFrame?.(() => view.needsRender());
      }
    }
  }

  private _usesBackgroundPendingSegmentPump(): boolean {
    return this._renderContext.memoryConfigs.maxBatchBuildSegments >= 0;
  }

  private _getRenderFrameBatchPrepareOptions(): TriangleBatchPrepareOptions {
    return {
      buildPendingSegments: !this._usesBackgroundPendingSegmentPump()
    };
  }

  private _schedulePendingSegmentPump(view: View): void {
    if (this._pendingSegmentPumpViews.has(view.id)) {
      return;
    }
    this._pendingSegmentPumpViews.add(view.id);
    const run = (): void => {
      if (!this._pendingSegmentPumpViews.delete(view.id)) {
        return;
      }
      if (!this._viewRenderCaches[view.id]) {
        return;
      }
      const batchSetResult = this._instanceBatcher.buildPendingSegments(this._meshManager);
      if (batchSetResult.ok === false) {
        return;
      }
      view.needsRender();
    };
    globalThis.setTimeout(run, 0);
  }

  private _getViewRenderCache(viewId: string): ViewRenderCache {
    let cache = this._viewRenderCaches[viewId];
    if (!cache) {
      cache = {
        structureVersion: -1,
        instanceDataVersion: -1,
        viewStateVersion: -1,
        cameraViewVersion: -1,
        cameraMatrixSnapshot: null,
        hasTransparent: false,
        totalInstances: 0,
        instanceFrame: null,
        batchSet: null,
        batches: {
          opaque: [],
          edges: [],
          transparent: [],
          xrayedOpaque: [],
          xrayedEdgesOpaque: [],
          xrayedTransparent: [],
          xrayedEdgesTransparent: [],
          highlightedOpaque: [],
          highlightedEdgesOpaque: [],
          highlightedTransparent: [],
          highlightedEdgesTransparent: [],
          selectedOpaque: [],
          selectedEdgesOpaque: [],
          selectedTransparent: [],
          selectedEdgesTransparent: []
        },
        snapEdgeBatches: [],
        meshStateByGlobalSlot: new Map(),
        knownMeshStates: new Set(),
        meshBaseKeys: new Map(),
        meshStateCount: 0,
        builtSegmentCount: 0,
        pendingSegmentCount: 0,
        cullStats: emptyCullStats(),
        transparentBins: createTransparentRenderBinCache()
      };
      this._viewRenderCaches[viewId] = cache;
    }
    return cache;
  }

  private _rememberMeshSlots(cache: ViewRenderCache, batchSet: TriangleBatchSet): void {
    cache.meshStateByGlobalSlot.clear();
    this._rememberMeshSlotsForSegments(cache, batchSet.segments);
  }

  private _rememberMeshSlotsForSegments(cache: ViewRenderCache, segments: TriangleBatchSegment[]): void {
    for (let segmentIndex = 0, segmentLen = segments.length; segmentIndex < segmentLen; segmentIndex++) {
      const segment = segments[segmentIndex];
      for (let slotIndex = 0, slotLen = segment.slots.length; slotIndex < slotLen; slotIndex++) {
        const slot = segment.slots[slotIndex];
        cache.meshStateByGlobalSlot.set(slot.globalSlot, slot.meshState);
      }
    }
  }

  private _rememberMeshStates(cache: ViewRenderCache, meshStates: ReadonlyArray<RendererMesh>): void {
    cache.knownMeshStates.clear();
    cache.meshBaseKeys.clear();
    for (let i = 0, len = meshStates.length; i < len; i++) {
      cache.knownMeshStates.add(meshStates[i]);
      cache.meshBaseKeys.set(meshStates[i], this._getMeshBaseKey(meshStates[i]));
    }
    cache.meshStateCount = meshStates.length;
  }

  private _getInstanceFrameCapacity(batchSet: TriangleBatchSet): number {
    return Math.max(batchSet.projectedInstanceCapacity, batchSet.instanceCapacity, this._meshManager.meshStates.length);
  }

  private _getMeshBaseKey(meshState: RendererMesh): string {
    const model = meshState.sceneModel ?? meshState.mesh.model;
    const lifecycle = model?.lifecycle ?? "dynamic";
    const memoryPolicy = model?.memoryPolicy ?? "stream";
    return `${model?.id ?? "unowned"}|${lifecycle}|${memoryPolicy}`;
  }

  private _isCameraMatrixUnchanged(cache: ViewRenderCache, view: View): boolean {
    const snapshot = cache.cameraMatrixSnapshot;
    if (!snapshot) {
      return false;
    }
    const camera = view.camera;
    const viewMatrix = camera.viewMatrix as ArrayLike<number>;
    const projMatrix = camera.projMatrix as ArrayLike<number>;
    for (let i = 0; i < 16; i++) {
      if (snapshot[i] !== viewMatrix[i] || snapshot[i + 16] !== projMatrix[i]) {
        return false;
      }
    }
    return true;
  }

  private _getFullRebuildReason(params: {
    cache: ViewRenderCache;
    structureVersion: number;
    instanceDataVersion: number;
    viewStateVersion: number;
    cameraMatrixChanged: boolean;
  }): string {
    const {cache, structureVersion, instanceDataVersion, viewStateVersion, cameraMatrixChanged} = params;
    if (cache.pendingSegmentCount > 0 || cache.structureVersion < 0) {
      return "pendingSegmentBuild";
    }
    if (cache.structureVersion !== structureVersion) {
      return "sceneStructureRebuild";
    }
    if (cache.instanceDataVersion !== instanceDataVersion) {
      return "instanceUpdate";
    }
    if (cache.viewStateVersion !== viewStateVersion) {
      return "viewObjectState";
    }
    if (this._usesCameraCulling() && cameraMatrixChanged) {
      return "cameraCullingRebuild";
    }
    if (cache.totalInstances > 0 && !cache.instanceFrame?.buffer) {
      return "instanceBufferRecreated";
    }
    return "fullRebuild";
  }

  private _rememberCameraMatrix(cache: ViewRenderCache, view: View): void {
    const camera = view.camera;
    const viewMatrix = camera.viewMatrix as ArrayLike<number>;
    const projMatrix = camera.projMatrix as ArrayLike<number>;
    let snapshot = cache.cameraMatrixSnapshot;
    if (!snapshot) {
      snapshot = new Array(32);
      cache.cameraMatrixSnapshot = snapshot;
    }
    for (let i = 0; i < 16; i++) {
      snapshot[i] = viewMatrix[i];
      snapshot[i + 16] = projMatrix[i];
    }
  }

  private _usesCameraCulling(): boolean {
    const memoryConfigs = this._renderContext.memoryConfigs;
    return memoryConfigs.frustumCulling || memoryConfigs.minProjectedCanvasSize > 0;
  }

  private _countVisibleDrawItems(bins: RenderBins): number {
    return bins.normalDrawOpaque.length +
      bins.normalFillTransparent.length +
      bins.xrayedFillOpaque.length +
      bins.xrayedFillTransparent.length +
      bins.highlightedFillOpaque.length +
      bins.highlightedFillTransparent.length +
      bins.selectedFillOpaque.length +
      bins.selectedFillTransparent.length;
  }

  private _hasTransparentDrawItems(bins: RenderBins): boolean {
    return bins.normalFillTransparent.length > 0 ||
      bins.xrayedFillTransparent.length > 0 ||
      bins.xrayedEdgesTransparent.length > 0 ||
      bins.highlightedFillTransparent.length > 0 ||
      bins.highlightedEdgesTransparent.length > 0 ||
      bins.selectedFillTransparent.length > 0 ||
      bins.selectedEdgesTransparent.length > 0;
  }

  private _hasEmphasisDrawItems(bins: RenderBins): boolean {
    return bins.xrayedFillOpaque.length > 0 ||
      bins.xrayedEdgesOpaque.length > 0 ||
      bins.xrayedFillTransparent.length > 0 ||
      bins.xrayedEdgesTransparent.length > 0 ||
      bins.highlightedFillOpaque.length > 0 ||
      bins.highlightedEdgesOpaque.length > 0 ||
      bins.highlightedFillTransparent.length > 0 ||
      bins.highlightedEdgesTransparent.length > 0 ||
      bins.selectedFillOpaque.length > 0 ||
      bins.selectedEdgesOpaque.length > 0 ||
      bins.selectedFillTransparent.length > 0 ||
      bins.selectedEdgesTransparent.length > 0;
  }

  private _hasTransparentBatches(batches: InstancedDrawBatches): boolean {
    return batches.transparent.length > 0 ||
      batches.xrayedTransparent.length > 0 ||
      batches.xrayedEdgesTransparent.length > 0 ||
      batches.highlightedTransparent.length > 0 ||
      batches.highlightedEdgesTransparent.length > 0 ||
      batches.selectedTransparent.length > 0 ||
      batches.selectedEdgesTransparent.length > 0;
  }

  private _getSectionPlanesForCaps(view: View): SectionPlaneCap[] {
    if (!view.effects?.sectionPlaneCaps?.applied) {
      return [];
    }
    return this._getActiveSectionPlanes(view);
  }

  private _getActiveSectionPlanes(view: View): SectionPlaneCap[] {
    const planes = (view as any).sectionPlanesList as Array<{
      active: boolean;
      dir: ArrayLike<number>;
      dist: number;
      capColor?: ArrayLike<number> | null;
    }> | undefined;
    if (!planes) {
      return [];
    }
    const activePlanes: SectionPlaneCap[] = [];
    for (let i = 0, len = planes.length; i < len; i++) {
      if (planes[i].active) {
        activePlanes.push(planes[i]);
      }
    }
    return activePlanes;
  }

  private _countBatches(batches: InstancedDrawBatches): number {
    return batches.opaque.length +
      batches.edges.length +
      batches.transparent.length +
      batches.xrayedOpaque.length +
      batches.xrayedEdgesOpaque.length +
      batches.xrayedTransparent.length +
      batches.xrayedEdgesTransparent.length +
      batches.highlightedOpaque.length +
      batches.highlightedEdgesOpaque.length +
      batches.highlightedTransparent.length +
      batches.highlightedEdgesTransparent.length +
      batches.selectedOpaque.length +
      batches.selectedEdgesOpaque.length +
      batches.selectedTransparent.length +
      batches.selectedEdgesTransparent.length;
  }

  private _getPickSurfaceBatches(batches: InstancedDrawBatches): InstancedDrawBatch[] {
    return [
      ...batches.opaque,
      ...batches.transparent,
      ...batches.xrayedOpaque,
      ...batches.xrayedTransparent,
      ...batches.highlightedOpaque,
      ...batches.highlightedTransparent,
      ...batches.selectedOpaque,
      ...batches.selectedTransparent
    ];
  }

  private _getEdgeSnapDrawItems(bins: RenderBins): DrawItem[] {
    return [
      ...bins.normalDrawOpaque,
      ...bins.normalFillTransparent,
      ...bins.xrayedFillOpaque,
      ...bins.xrayedFillTransparent,
      ...bins.highlightedFillOpaque,
      ...bins.highlightedFillTransparent,
      ...bins.selectedFillOpaque,
      ...bins.selectedFillTransparent
    ];
  }

  private _rememberTransparentBins(cache: ViewRenderCache, bins: RenderBins): void {
    copyDrawItems(bins.normalFillTransparent, cache.transparentBins.normalFillTransparent);
    copyDrawItems(bins.xrayedFillTransparent, cache.transparentBins.xrayedFillTransparent);
    copyDrawItems(bins.xrayedEdgesTransparent, cache.transparentBins.xrayedEdgesTransparent);
    copyDrawItems(bins.highlightedFillTransparent, cache.transparentBins.highlightedFillTransparent);
    copyDrawItems(bins.highlightedEdgesTransparent, cache.transparentBins.highlightedEdgesTransparent);
    copyDrawItems(bins.selectedFillTransparent, cache.transparentBins.selectedFillTransparent);
    copyDrawItems(bins.selectedEdgesTransparent, cache.transparentBins.selectedEdgesTransparent);
  }

  private _restoreTransparentBins(cache: ViewRenderCache, view: View): void {
    clearRenderBins(this._bins);
    restoreTransparentDrawItems(cache.transparentBins.normalFillTransparent, this._bins.normalFillTransparent, view, this._meshManager);
    restoreTransparentDrawItems(cache.transparentBins.xrayedFillTransparent, this._bins.xrayedFillTransparent, view, this._meshManager);
    restoreTransparentDrawItems(cache.transparentBins.xrayedEdgesTransparent, this._bins.xrayedEdgesTransparent, view, this._meshManager);
    restoreTransparentDrawItems(cache.transparentBins.highlightedFillTransparent, this._bins.highlightedFillTransparent, view, this._meshManager);
    restoreTransparentDrawItems(cache.transparentBins.highlightedEdgesTransparent, this._bins.highlightedEdgesTransparent, view, this._meshManager);
    restoreTransparentDrawItems(cache.transparentBins.selectedFillTransparent, this._bins.selectedFillTransparent, view, this._meshManager);
    restoreTransparentDrawItems(cache.transparentBins.selectedEdgesTransparent, this._bins.selectedEdgesTransparent, view, this._meshManager);
  }

  private _restoreTransparentSegmentBins(cache: ViewRenderCache, view: View, batchSet: TriangleBatchSet): void {
    clearRenderBins(this._bins);
    restoreTransparentSegmentDrawItems(cache.transparentBins.normalFillTransparent, this._bins.normalFillTransparent, view, batchSet);
    restoreTransparentSegmentDrawItems(cache.transparentBins.xrayedFillTransparent, this._bins.xrayedFillTransparent, view, batchSet);
    restoreTransparentSegmentDrawItems(cache.transparentBins.xrayedEdgesTransparent, this._bins.xrayedEdgesTransparent, view, batchSet);
    restoreTransparentSegmentDrawItems(cache.transparentBins.highlightedFillTransparent, this._bins.highlightedFillTransparent, view, batchSet);
    restoreTransparentSegmentDrawItems(cache.transparentBins.highlightedEdgesTransparent, this._bins.highlightedEdgesTransparent, view, batchSet);
    restoreTransparentSegmentDrawItems(cache.transparentBins.selectedFillTransparent, this._bins.selectedFillTransparent, view, batchSet);
    restoreTransparentSegmentDrawItems(cache.transparentBins.selectedEdgesTransparent, this._bins.selectedEdgesTransparent, view, batchSet);
  }

  private _sortCachedTransparentSegmentBatches(cache: ViewRenderCache, batchSet: TriangleBatchSet): void {
    this._sortCachedBatchListByDrawItems(cache.batches.transparent, this._bins.normalFillTransparent, batchSet);
    this._sortCachedBatchListByDrawItems(cache.batches.xrayedTransparent, this._bins.xrayedFillTransparent, batchSet);
    this._sortCachedBatchListByDrawItems(cache.batches.xrayedEdgesTransparent, this._bins.xrayedEdgesTransparent, batchSet);
    this._sortCachedBatchListByDrawItems(cache.batches.highlightedTransparent, this._bins.highlightedFillTransparent, batchSet);
    this._sortCachedBatchListByDrawItems(cache.batches.highlightedEdgesTransparent, this._bins.highlightedEdgesTransparent, batchSet);
    this._sortCachedBatchListByDrawItems(cache.batches.selectedTransparent, this._bins.selectedFillTransparent, batchSet);
    this._sortCachedBatchListByDrawItems(cache.batches.selectedEdgesTransparent, this._bins.selectedEdgesTransparent, batchSet);
  }

  private _sortCachedBatchListByDrawItems(
    batches: InstancedDrawBatch[],
    drawItems: DrawItem[],
    batchSet: TriangleBatchSet
  ): void {
    if (batches.length < 2 || drawItems.length === 0) {
      return;
    }
    const orderBySegmentKey = new Map<string, number>();
    for (let i = 0, len = drawItems.length; i < len; i++) {
      const segment = batchSet.segmentByMeshId[drawItems[i].meshState.mesh.uniqueId];
      if (!segment || orderBySegmentKey.has(segment.key)) {
        continue;
      }
      orderBySegmentKey.set(segment.key, orderBySegmentKey.size);
    }
    batches.sort((a, b) => {
      const aOrder = orderBySegmentKey.get(a.packedBatch.segmentKey) ?? Number.MAX_SAFE_INTEGER;
      const bOrder = orderBySegmentKey.get(b.packedBatch.segmentKey) ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      return a.packedBatch.label < b.packedBatch.label ? -1 : a.packedBatch.label > b.packedBatch.label ? 1 : 0;
    });
  }

  private _copyBatches(source: InstancedDrawBatches, target: InstancedDrawBatches): void {
    this._replaceBatches(source.opaque, target.opaque);
    this._replaceBatches(source.edges, target.edges);
    this._replaceBatches(source.transparent, target.transparent);
    this._replaceBatches(source.xrayedOpaque, target.xrayedOpaque);
    this._replaceBatches(source.xrayedEdgesOpaque, target.xrayedEdgesOpaque);
    this._replaceBatches(source.xrayedTransparent, target.xrayedTransparent);
    this._replaceBatches(source.xrayedEdgesTransparent, target.xrayedEdgesTransparent);
    this._replaceBatches(source.highlightedOpaque, target.highlightedOpaque);
    this._replaceBatches(source.highlightedEdgesOpaque, target.highlightedEdgesOpaque);
    this._replaceBatches(source.highlightedTransparent, target.highlightedTransparent);
    this._replaceBatches(source.highlightedEdgesTransparent, target.highlightedEdgesTransparent);
    this._replaceBatches(source.selectedOpaque, target.selectedOpaque);
    this._replaceBatches(source.selectedEdgesOpaque, target.selectedEdgesOpaque);
    this._replaceBatches(source.selectedTransparent, target.selectedTransparent);
    this._replaceBatches(source.selectedEdgesTransparent, target.selectedEdgesTransparent);
  }

  private _replaceSnapEdgeBatches(cache: ViewRenderCache, batches: InstancedDrawBatch[]): void {
    this._clearBatchList(cache.snapEdgeBatches);
    for (let i = 0, len = batches.length; i < len; i++) {
      cache.snapEdgeBatches.push(batches[i]);
    }
  }

  private _clearCachedBatches(batches: InstancedDrawBatches): void {
    this._clearBatchList(batches.opaque);
    this._clearBatchList(batches.edges);
    this._clearBatchList(batches.transparent);
    this._clearBatchList(batches.xrayedOpaque);
    this._clearBatchList(batches.xrayedEdgesOpaque);
    this._clearBatchList(batches.xrayedTransparent);
    this._clearBatchList(batches.xrayedEdgesTransparent);
    this._clearBatchList(batches.highlightedOpaque);
    this._clearBatchList(batches.highlightedEdgesOpaque);
    this._clearBatchList(batches.highlightedTransparent);
    this._clearBatchList(batches.highlightedEdgesTransparent);
    this._clearBatchList(batches.selectedOpaque);
    this._clearBatchList(batches.selectedEdgesOpaque);
    this._clearBatchList(batches.selectedTransparent);
    this._clearBatchList(batches.selectedEdgesTransparent);
  }

  private _replaceBatches(source: InstancedDrawBatch[], target: InstancedDrawBatch[]): void {
    this._clearBatchList(target);
    for (let i = 0, len = source.length; i < len; i++) {
      const batch = source[i];
      target.push({
        packedBatch: batch.packedBatch
      });
    }
    source.length = 0;
  }

  private _clearBatchList(batches: InstancedDrawBatch[]): void {
    for (let i = 0, len = batches.length; i < len; i++) {
      try {
        batches[i].packedBatch.destroy();
      } catch {
        // Ignore buffer destruction failures during teardown.
      }
    }
    batches.length = 0;
  }
}

function emptyCullStats(): RenderCullStats {
  return {
    considered: 0,
    rendered: 0,
    frustumCulled: 0,
    projectedSizeCulled: 0,
    segmentCandidates: 0,
    segmentFrustumCulled: 0,
    segmentFullyDrawn: 0,
    segmentPartiallyRefined: 0
  };
}

function cloneCullStats(stats: RenderCullStats): RenderCullStats {
  return {
    considered: stats.considered,
    rendered: stats.rendered,
    frustumCulled: stats.frustumCulled,
    projectedSizeCulled: stats.projectedSizeCulled,
    segmentCandidates: stats.segmentCandidates,
    segmentFrustumCulled: stats.segmentFrustumCulled,
    segmentFullyDrawn: stats.segmentFullyDrawn,
    segmentPartiallyRefined: stats.segmentPartiallyRefined
  };
}

function addCullStats(a: RenderCullStats, b: RenderCullStats): RenderCullStats {
  return {
    considered: a.considered + b.considered,
    rendered: a.rendered + b.rendered,
    frustumCulled: a.frustumCulled + b.frustumCulled,
    projectedSizeCulled: a.projectedSizeCulled + b.projectedSizeCulled,
    segmentCandidates: a.segmentCandidates + b.segmentCandidates,
    segmentFrustumCulled: a.segmentFrustumCulled + b.segmentFrustumCulled,
    segmentFullyDrawn: a.segmentFullyDrawn + b.segmentFullyDrawn,
    segmentPartiallyRefined: a.segmentPartiallyRefined + b.segmentPartiallyRefined
  };
}

function createTransparentRenderBinCache(): TransparentRenderBinCache {
  return {
    normalFillTransparent: [],
    xrayedFillTransparent: [],
    xrayedEdgesTransparent: [],
    highlightedFillTransparent: [],
    highlightedEdgesTransparent: [],
    selectedFillTransparent: [],
    selectedEdgesTransparent: []
  };
}

function copyDrawItems(source: DrawItem[], target: DrawItem[]): void {
  target.length = 0;
  for (let i = 0, len = source.length; i < len; i++) {
    const item = source[i];
    target.push({
      meshState: item.meshState,
      opacity: item.opacity,
      viewDepth: item.viewDepth
    });
  }
}

function restoreTransparentDrawItems(source: DrawItem[], target: DrawItem[], view: View, meshManager: MeshManager): void {
  target.length = 0;
  for (let i = 0, len = source.length; i < len; i++) {
    const item = source[i];
    item.viewDepth = meshManager.getMeshViewDepth(item.meshState, view);
    target.push(item);
  }
  target.sort(compareDrawItemDepth);
}

interface TransparentSegmentDrawItemGroup {
  segment: TriangleBatchSegment;
  depth: number;
  drawItems: DrawItem[];
}

function restoreTransparentSegmentDrawItems(source: DrawItem[], target: DrawItem[], view: View, batchSet: TriangleBatchSet): void {
  target.length = 0;
  if (source.length === 0) {
    return;
  }

  const groupBySegmentKey = new Map<string, TransparentSegmentDrawItemGroup>();
  const groups: TransparentSegmentDrawItemGroup[] = [];
  for (let i = 0, len = source.length; i < len; i++) {
    const item = source[i];
    const segment = batchSet.segmentByMeshId[item.meshState.mesh.uniqueId];
    if (!segment) {
      continue;
    }
    let group = groupBySegmentKey.get(segment.key);
    if (!group) {
      group = {
        segment,
        depth: getSegmentViewDepth(segment, view),
        drawItems: []
      };
      groupBySegmentKey.set(segment.key, group);
      groups.push(group);
    }
    item.viewDepth = group.depth;
    group.drawItems.push(item);
  }

  groups.sort(compareTransparentSegmentGroupDepth);
  for (let groupIndex = 0, groupLen = groups.length; groupIndex < groupLen; groupIndex++) {
    const group = groups[groupIndex];
    for (let itemIndex = 0, itemLen = group.drawItems.length; itemIndex < itemLen; itemIndex++) {
      target.push(group.drawItems[itemIndex]);
    }
  }
}

function getSegmentViewDepth(segment: TriangleBatchSegment, view: View): number {
  const aabb = segment.worldAABB;
  const x = (aabb[0] + aabb[3]) * 0.5;
  const y = (aabb[1] + aabb[4]) * 0.5;
  const z = (aabb[2] + aabb[5]) * 0.5;
  const viewMatrix = view.camera?.viewMatrix as Mat4 | undefined;
  if (!viewMatrix) {
    return z;
  }
  return viewMatrix[2] * x + viewMatrix[6] * y + viewMatrix[10] * z + viewMatrix[14];
}

function compareTransparentSegmentGroupDepth(a: TransparentSegmentDrawItemGroup, b: TransparentSegmentDrawItemGroup): number {
  if (a.depth !== b.depth) {
    return a.depth - b.depth;
  }
  return a.segment.key < b.segment.key ? -1 : a.segment.key > b.segment.key ? 1 : 0;
}

function compareDrawItemDepth(a: DrawItem, b: DrawItem): number {
  return a.viewDepth - b.viewDepth;
}

function clearTransparentRenderBinCache(cache: TransparentRenderBinCache): void {
  cache.normalFillTransparent.length = 0;
  cache.xrayedFillTransparent.length = 0;
  cache.xrayedEdgesTransparent.length = 0;
  cache.highlightedFillTransparent.length = 0;
  cache.highlightedEdgesTransparent.length = 0;
  cache.selectedFillTransparent.length = 0;
  cache.selectedEdgesTransparent.length = 0;
}

function clearRenderBins(bins: RenderBins): void {
  bins.normalDrawOpaque.length = 0;
  bins.normalEdgesOpaque.length = 0;
  bins.normalFillTransparent.length = 0;
  bins.xrayedFillOpaque.length = 0;
  bins.xrayedEdgesOpaque.length = 0;
  bins.xrayedFillTransparent.length = 0;
  bins.xrayedEdgesTransparent.length = 0;
  bins.highlightedFillOpaque.length = 0;
  bins.highlightedEdgesOpaque.length = 0;
  bins.highlightedFillTransparent.length = 0;
  bins.highlightedEdgesTransparent.length = 0;
  bins.selectedFillOpaque.length = 0;
  bins.selectedEdgesOpaque.length = 0;
  bins.selectedFillTransparent.length = 0;
  bins.selectedEdgesTransparent.length = 0;
}
