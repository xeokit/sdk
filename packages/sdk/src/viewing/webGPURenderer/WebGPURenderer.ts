import {EventDispatcher} from "strongly-typed-events";
import {EventEmitter, SDKErrorType, type SDKResult} from "../../base/core";
import type {SceneGeometry, SceneMesh, SceneModel, SceneModelBatch, SceneObject} from "../../model/scene";
import type {Renderer, RendererError} from "../renderer";
import type {PickParams, PickResult, View, Viewer} from "../viewer";
import {ViewManager} from "./internal";
import type {RenderInspector, ViewRenderStats} from "./internal/inspectors";
import {createMemoryConfigs} from "./createMemoryConfigs";
import {createWebGPURenderConfigs} from "./createWebGPURenderConfigs";
import type {MemoryConfigs} from "./MemoryConfigs";
import type {WebGPUMemoryStats} from "./WebGPUMemoryStats";
import type {WebGPURenderConfigs} from "./WebGPURenderConfigs";
import type {WebGPURendererEvents} from "./WebGPURendererEvents";
import type {WebGPUViewRenderStats} from "./WebGPUViewRenderStats";
import type {
  WebGPUAdapterLike,
  WebGPUCanvasAlphaMode,
  WebGPUDeviceDescriptor,
  WebGPUDeviceLike,
  WebGPURendererParams
} from "./WebGPURendererParams";
import type {
  GlobalWithOptionalWebGPU,
  WebGPUDeviceLostInfoLike,
  WebGPUNavigatorLike
} from "./core/types";

interface DeferredSceneModelRegistrations {
  geometries: Set<SceneGeometry>;
  meshes: Set<SceneMesh>;
  objects: Set<SceneObject>;
}

const WEBGPU_MULTI_DRAW_INDIRECT_FEATURE = "chromium-experimental-multi-draw-indirect";
const WEBGPU_DEFAULT_MAX_STORAGE_BUFFER_BINDING_SIZE = 128 * 1024 * 1024;

/**
 * WebGPU renderer backend.
 *
 * This public class owns viewer attachment, event wiring, device acquisition,
 * and backend-neutral renderer contracts. Per-view WebGPU canvas state, GPU
 * buffers, pipelines, and draw submission are owned by the internal
 * {@link ViewManager}, matching the composition used by WebGLRenderer.
 */
export class WebGPURenderer implements Renderer {

  private _viewer: Viewer | null = null;
  private _viewerSubs: (() => void)[] = [];
  private _viewManagerSubs: (() => void)[] = [];
  private _viewManager: ViewManager | null = null;
  private _destroyed = false;
  private _deviceLost = false;
  private _deviceLostWatchToken: object | null = null;
  private _device: WebGPUDeviceLike | null;
  private readonly _contextFormat: string;
  private readonly _alphaMode?: WebGPUCanvasAlphaMode;
  private readonly _destroyDeviceOnDestroy: boolean;
  private readonly _memoryConfigs: MemoryConfigs;
  private readonly _renderConfigs: WebGPURenderConfigs;
  private _renderSuspendCount = 0;
  private _deferredSceneModelRegistrations: Map<SceneModel, DeferredSceneModelRegistrations> = new Map();

  /**
   * Enables or disables logging of renderer errors to the console.
   */
  public logging = true;

  /**
   * Events emitted by this renderer.
   */
  public readonly events: WebGPURendererEvents = {
    onViewerAttached: new EventEmitter(new EventDispatcher<WebGPURenderer, Viewer>()),
    onViewerDetached: new EventEmitter(new EventDispatcher<WebGPURenderer, Viewer>()),
    onRendererStarted: new EventEmitter(new EventDispatcher<WebGPURenderer, void>()),
    onViewRendered: new EventEmitter(new EventDispatcher<WebGPURenderer, View>()),
    onRendererStopped: new EventEmitter(new EventDispatcher<WebGPURenderer, void>()),
    onRendererDestroyed: new EventEmitter(new EventDispatcher<WebGPURenderer, boolean>()),
    onContextLost: new EventEmitter(new EventDispatcher<WebGPURenderer, Event>()),
    onContextRestored: new EventEmitter(new EventDispatcher<WebGPURenderer, void>()),
    onError: new EventEmitter(new EventDispatcher<WebGPURenderer, RendererError>())
  };

  /**
   * Creates a WebGPU renderer.
   *
   * @param params - Optional renderer configuration.
   */
  constructor(params: WebGPURendererParams = {}) {
    this.logging = params.logging ?? true;
    this._device = params.device ?? null;
    this._contextFormat = params.contextFormat ?? WebGPURenderer._getPreferredCanvasFormat();
    this._alphaMode = params.alphaMode;
    this._destroyDeviceOnDestroy = params.destroyDeviceOnDestroy ?? false;
    this._memoryConfigs = createMemoryConfigs({
      grossMemoryMB: 512,
      device: "medium",
      utilization: 0.5,
      user: params.memoryConfigs
    });
    this._renderConfigs = createWebGPURenderConfigs(params.renderConfigs);
    this._watchDeviceLost();
    if (params.viewer) {
      this.attachViewer(params.viewer);
    }
  }

  /**
   * Creates a WebGPU renderer after asynchronously requesting a device.
   *
   * The shared {@link Renderer.attachViewer} contract is synchronous, while
   * browser WebGPU device creation is asynchronous. This factory bridges that
   * mismatch: call it first, then attach the returned renderer normally.
   *
   * @param params - Optional WebGPU adapter/device and renderer settings.
   * @returns SDK result containing an initialized renderer.
   */
  public static async create(params: WebGPURendererParams = {}): Promise<SDKResult<WebGPURenderer>> {
    let device = params.device ?? null;
    let contextFormat = params.contextFormat;
    let ownsDevice = params.device ? false : true;

    try {
      if (!device) {
        const gpu = WebGPURenderer._getGPU();
        const adapter: WebGPUAdapterLike | null | undefined =
          params.adapter ?? await gpu?.requestAdapter(params.requestAdapterOptions);

        if (!adapter) {
          return {
            ok: false,
            type: SDKErrorType.NotSupported,
            error: "[WebGPURenderer.create] WebGPU is not available in this runtime."
          };
        }

        device = await adapter.requestDevice(WebGPURenderer._createDeviceDescriptor({
          descriptor: params.deviceDescriptor,
          adapter,
          gpuTimestamps: params.renderConfigs?.gpuTimestamps === true
        }));
        contextFormat = contextFormat ?? gpu?.getPreferredCanvasFormat?.();
      } else {
        ownsDevice = false;
      }
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[WebGPURenderer.create] Failed to initialize WebGPU device: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    const {viewer, ...rendererParams} = params;
    const renderer = new WebGPURenderer({
      ...rendererParams,
      device,
      contextFormat,
      destroyDeviceOnDestroy: params.destroyDeviceOnDestroy ?? ownsDevice
    });

    if (viewer) {
      const attachResult = renderer.attachViewer(viewer);
      if (attachResult.ok === false) {
        renderer.destroy();
        return {
          ok: false,
          type: attachResult.type,
          error: attachResult.error
        };
      }
    }

    return {
      ok: true,
      value: renderer
    };
  }

  /**
   * Whether the current runtime exposes the browser WebGPU entry point.
   */
  public static isSupported(): boolean {
    return !!WebGPURenderer._getGPU();
  }

  /**
   * Viewer currently attached to this renderer.
   */
  public get viewer(): Viewer | null {
    return this._viewer;
  }

  /**
   * Whether this renderer currently has active rendering state.
   */
  public get rendering(): boolean {
    return !!this._viewManager;
  }

  /**
   * Whether this renderer has an injected/acquired WebGPU device or the current
   * runtime exposes the browser WebGPU entry point.
   */
  public get supported(): boolean {
    return !!this._device || WebGPURenderer.isSupported();
  }

  /**
   * Attaches a Viewer to this renderer.
   *
   * Use {@link create} or pass a pre-created `device` before calling this
   * method. Device creation is asynchronous and cannot happen inside the
   * backend-neutral synchronous renderer contract.
   *
   * @param viewer - Viewer to attach.
   * @returns SDK result indicating whether attachment succeeded.
   */
  public attachViewer(viewer: Viewer): SDKResult<void> {
    if (this._destroyed) {
      return this._error(
        SDKErrorType.InvalidOperation,
        "[WebGPURenderer.attachViewer] Renderer has been destroyed."
      );
    }

    if (this._viewer) {
      return this._error(
        SDKErrorType.InvalidOperation,
        "[WebGPURenderer.attachViewer] Failed to attach Viewer - a Viewer is already attached."
      );
    }

    if (this._deviceLost) {
      return this._error(
        SDKErrorType.InvalidOperation,
        "[WebGPURenderer.attachViewer] WebGPU device has been lost."
      );
    }

    if (!this._device) {
      return this._error(
        SDKErrorType.NotSupported,
        "[WebGPURenderer.attachViewer] WebGPU device is not initialized. Use WebGPURenderer.create() or pass a pre-created device."
      );
    }

    this._viewer = viewer;

    const viewerEvents = viewer.events;
    this._viewerSubs = [
      viewerEvents.onSceneAttached.subscribe(() => {
        const result = this._createViewManager();
        if (this._logError(result).ok) {
          this.events.onRendererStarted.dispatch(this);
        }
      }),
      viewerEvents.onSceneDetached.subscribe(() => {
        this._destroyViewManager();
      }),
      viewerEvents.onViewerDestroyed.subscribe(() => {
        this.detachViewer();
      })
    ];

    if (viewer.scene) {
      const result = this._createViewManager();
      if (result.ok === false) {
        this._rollbackViewerAttach();
        return this._logError({
          ok: false,
          type: result.type,
          error: `[WebGPURenderer.attachViewer] Failed to attach Viewer - ${result.error}`
        });
      }
      this.events.onViewerAttached.dispatch(this, viewer);
      this.events.onRendererStarted.dispatch(this);
    } else {
      this.events.onViewerAttached.dispatch(this, viewer);
    }

    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Detaches the current Viewer, if any.
   */
  public detachViewer(): void {
    if (!this._viewer) {
      return;
    }
    this._destroyViewManager();
    for (const sub of this._viewerSubs) {
      sub();
    }
    this._viewerSubs = [];
    const viewer = this._viewer;
    this._viewer = null;
    this.events.onViewerDetached.dispatch(this, viewer);
  }

  /**
   * Permanently releases renderer resources.
   */
  public destroy(): void {
    if (this._destroyed) {
      return;
    }
    this.detachViewer();
    this._deviceLostWatchToken = null;
    if (this._destroyDeviceOnDestroy) {
      try {
        this._device?.destroy?.();
      } catch {
        // Ignore device destruction failures; the renderer is already tearing down.
      }
    }
    this._device = null;
    this._destroyed = true;
    this.events.onRendererDestroyed.dispatch(this, true);
  }

  /**
   * Performs a renderer-backed pick in a View.
   *
   * Supports triangle mesh object picking, surface hit details, and first-pass
   * vertex/edge snapping using renderer-side decoded triangle data.
   *
   * @param view - View whose canvas coordinates are being picked.
   * @param pickParams - Picking options and canvas coordinates.
   * @returns The picked result, `null` when nothing was hit, or an SDK error result.
   */
  public pick(view: View, pickParams: PickParams): SDKResult<PickResult> {
    if (!this._viewManager) {
      return this._error(
        SDKErrorType.InvalidOperation,
        "[WebGPURenderer.pick] Viewer with Scene is not currently attached."
      );
    }

    if (view.viewer !== this._viewer) {
      return this._error(
        SDKErrorType.InvalidOperation,
        "[WebGPURenderer.pick] The specified View does not belong to the currently attached Viewer."
      );
    }

    return this._viewManager.pick(view, pickParams);
  }

  /**
   * Performs the WebGPU object-ID pick pass and resolves the hit asynchronously.
   *
   * This is an internal bridge while the public renderer pick API remains
   * synchronous. Surface details are still resolved from decoded mesh data after
   * the GPU pass selects the front-most mesh.
   *
   * @internal
   */
  public async pickGPUAsync(view: View, pickParams: PickParams): Promise<SDKResult<PickResult>> {
    if (!this._viewManager) {
      return this._error(
        SDKErrorType.InvalidOperation,
        "[WebGPURenderer.pickGPUAsync] Viewer with Scene is not currently attached."
      );
    }

    if (view.viewer !== this._viewer) {
      return this._error(
        SDKErrorType.InvalidOperation,
        "[WebGPURenderer.pickGPUAsync] The specified View does not belong to the currently attached Viewer."
      );
    }

    return this._viewManager.pickGPUAsync(view, pickParams);
  }

  /**
   * Gets the lightweight WebGPU render inspector.
   *
   * Enable the returned inspector to collect per-frame draw-call and CPU timing
   * stats for the current WebGPU render path.
   */
  public getRenderInspector(): SDKResult<RenderInspector> {
    if (!this._viewManager) {
      return this._error(
        SDKErrorType.InvalidOperation,
        "[WebGPURenderer.getRenderInspector] Viewer with Scene is not currently attached."
      );
    }

    return {
      ok: true,
      value: this._viewManager.getRenderInspector()
    };
  }

  /**
   * Enables or disables the renderer-owned infinite ground grid.
   *
   * Disabled by default for bare renderer use. Studio enables it during
   * initialization for its default scene reference plane.
   */
  public setInfiniteGridEnabled(enabled: boolean): SDKResult<void> {
    if (!this._viewManager) {
      return this._error(
        SDKErrorType.InvalidOperation,
        "[WebGPURenderer.setInfiniteGridEnabled] Failed to set infinite grid visibility - no Viewer with Scene is currently attached."
      );
    }
    this._viewManager.setInfiniteGridEnabled(enabled);
    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Gets summary stats for the last rendered frame of a View.
   *
   * @param viewIndex - Zero-based Viewer View index.
   * @returns Last frame stats for the View, or `null` when no frame stats are available.
   */
  public getViewRenderStats(viewIndex: number): WebGPUViewRenderStats | null {
    const inspector = this._viewManager?.getRenderInspector();
    const stats = inspector?.renderStats.views?.[viewIndex];
    if (!stats) {
      return null;
    }
    return {
      numDrawCalls: stats.numDrawCalls,
      numPrimitives: stats.numPrims,
      numBatches: stats.numBatches,
      renderBins: stats.renderBins.map((bin) => ({
        name: bin.name,
        numDrawCalls: bin.drawCalls.length,
        numPrimitives: bin.drawCalls.reduce((sum, drawCall) => sum + drawCall.numPrims, 0)
      })),
      numRTCTiles: stats.numRTCTiles,
      numRTCTileMatrixUploads: stats.numRTCTileMatrixUploads,
      numMeshesWithRTCTile: stats.numMeshesWithRTCTile,
      numMeshesUsingRTCFallback: stats.numMeshesUsingRTCFallback,
      frameTimeMs: stats.timeMs.duration,
      cpuTime: stats.cpuTime
    };
  }

  /**
   * Gets a compact summary of GPU memory owned by the WebGPU renderer.
   */
  public getMemoryStats(): WebGPUMemoryStats | null {
    return this._viewManager?.getMemoryStats() ?? null;
  }

  /**
   * Captures the current contents of a View as an image data URL.
   *
   * Snapshots are not implemented until the WebGPU rendering pipeline exists.
   *
   * @param view - View to snapshot.
   * @returns An SDK error result.
   */
  public getSnapshot(view: View): SDKResult<string> {
    if (!this._viewer) {
      return this._error(
        SDKErrorType.InvalidOperation,
        "[WebGPURenderer.getSnapshot] Viewer with Scene is not currently attached."
      );
    }

    if (view.viewer !== this._viewer) {
      return this._error(
        SDKErrorType.InvalidOperation,
        "[WebGPURenderer.getSnapshot] The specified View does not belong to the currently attached Viewer."
      );
    }

    return this._error(
      SDKErrorType.NotSupported,
      "[WebGPURenderer.getSnapshot] WebGPU snapshots are not implemented yet."
    );
  }

  private static _getGPU(): WebGPUNavigatorLike | null {
    return ((globalThis as GlobalWithOptionalWebGPU).navigator?.gpu) ?? null;
  }

  private static _getPreferredCanvasFormat(): string {
    return WebGPURenderer._getGPU()?.getPreferredCanvasFormat?.() ?? "bgra8unorm";
  }

  private _rollbackViewerAttach(): void {
    this._destroyViewManager(false);
    for (const sub of this._viewerSubs) {
      sub();
    }
    this._viewerSubs = [];
    this._viewer = null;
  }

  private _getDeferredSceneModelRegistrations(sceneModel: SceneModel): DeferredSceneModelRegistrations {
    let registrations = this._deferredSceneModelRegistrations.get(sceneModel);
    if (!registrations) {
      registrations = {
        geometries: new Set(),
        meshes: new Set(),
        objects: new Set()
      };
      this._deferredSceneModelRegistrations.set(sceneModel, registrations);
    }
    return registrations;
  }

  private _deferSceneGeometryCreated(sceneGeometry: SceneGeometry): boolean {
    const sceneModel = sceneGeometry.model;
    if (!sceneModel || (!sceneModel.building && !sceneModel.activeBatch?.includesGeometry(sceneGeometry))) {
      return false;
    }
    this._getDeferredSceneModelRegistrations(sceneModel).geometries.add(sceneGeometry);
    return true;
  }

  private _deferSceneMeshCreated(sceneMesh: SceneMesh): boolean {
    const sceneModel = sceneMesh.model;
    if (!sceneModel || (!sceneModel.building && !sceneModel.activeBatch?.includesMesh(sceneMesh))) {
      return false;
    }
    this._getDeferredSceneModelRegistrations(sceneModel).meshes.add(sceneMesh);
    return true;
  }

  private _deferSceneObjectCreated(sceneObject: SceneObject): boolean {
    const sceneModel = sceneObject.model;
    if (!sceneModel || (!sceneModel.building && !sceneModel.activeBatch?.includesObject(sceneObject))) {
      return false;
    }
    this._getDeferredSceneModelRegistrations(sceneModel).objects.add(sceneObject);
    return true;
  }

  private _discardDeferredSceneGeometry(sceneGeometry: SceneGeometry): boolean {
    return this._deferredSceneModelRegistrations.get(sceneGeometry.model)?.geometries.delete(sceneGeometry) === true;
  }

  private _discardDeferredSceneMesh(sceneMesh: SceneMesh): boolean {
    return this._deferredSceneModelRegistrations.get(sceneMesh.model)?.meshes.delete(sceneMesh) === true;
  }

  private _discardDeferredSceneObject(sceneObject: SceneObject): boolean {
    return this._deferredSceneModelRegistrations.get(sceneObject.model)?.objects.delete(sceneObject) === true;
  }

  private _flushDeferredSceneModelRegistrations(sceneModel: SceneModel, viewManager: ViewManager, batch?: SceneModelBatch): void {
    const registrations = this._deferredSceneModelRegistrations.get(sceneModel);
    if (!registrations && !batch) {
      return;
    }

    this._deferredSceneModelRegistrations.delete(sceneModel);

    const geometries = new Set<SceneGeometry>([
      ...(registrations?.geometries ?? []),
      ...(batch?.geometries ?? [])
    ]);
    for (const sceneGeometry of geometries) {
      if (!sceneGeometry.destroyed && sceneModel.geometries[sceneGeometry.id] === sceneGeometry) {
        this._logError(viewManager.sceneGeometryCreated(sceneGeometry));
      }
    }

    const meshes = new Set<SceneMesh>([
      ...(registrations?.meshes ?? []),
      ...(batch?.meshes ?? [])
    ]);
    for (const sceneMesh of meshes) {
      if (!sceneMesh.destroyed && sceneModel.meshes[sceneMesh.id] === sceneMesh) {
        this._logError(viewManager.sceneMeshCreated(sceneMesh));
      }
    }

    const objects = new Set<SceneObject>([
      ...(registrations?.objects ?? []),
      ...(batch?.objects ?? [])
    ]);
    for (const sceneObject of objects) {
      if (!sceneObject.destroyed && sceneModel.objects[sceneObject.id] === sceneObject) {
        this._logError(viewManager.sceneObjectCreated(sceneObject));
      }
    }
  }

  private _createViewManager(): SDKResult<void> {
    if (this._viewManager) {
      return {
        ok: true,
        value: undefined
      };
    }

    if (!this._viewer?.scene) {
      return {
        ok: true,
        value: undefined
      };
    }

    if (!this._device) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[WebGPURenderer._createViewManager] WebGPU device is not initialized."
      };
    }

    if (this._deviceLost) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[WebGPURenderer._createViewManager] WebGPU device has been lost."
      };
    }

    const viewManager = new ViewManager();
    this._viewManager = viewManager;
    this._subscribeViewManager(viewManager);

    const result = viewManager.init({
      viewer: this._viewer,
      device: this._device,
      contextFormat: this._contextFormat,
      alphaMode: this._alphaMode,
      memoryConfigs: this._memoryConfigs,
      renderConfigs: this._renderConfigs
    });

    if (result.ok === false) {
      this._unsubscribeViewManager();
      this._viewManager = null;
      viewManager.destroy();
      return result;
    }

    return {
      ok: true,
      value: undefined
    };
  }

  private _subscribeViewManager(viewManager: ViewManager): void {
    if (!this._viewer) {
      return;
    }

    const viewerEvents = this._viewer.events;
    this._viewManagerSubs = [
      viewerEvents.onViewCreated.subscribe((_viewer, view) => {
        if (this._viewManager !== viewManager) {
          return;
        }
        const result = viewManager.viewCreated(view);
        if (this._logError(result).ok) {
          view.needsRender();
        }
      }),
      viewerEvents.onViewUpdated.subscribe((_view, view) => {
        if (this._viewManager !== viewManager) {
          return;
        }
        if (this._renderSuspendCount > 0) {
          return;
        }
        const result = viewManager.viewUpdated(view);
        if (this._logError(result).ok) {
          this.events.onViewRendered.dispatch(this, view);
        }
      }),
      viewerEvents.onViewDestroyed.subscribe((_viewer, view) => {
        if (this._viewManager === viewManager) {
          viewManager.viewDestroyed(view);
        }
      }),
      viewerEvents.onViewObjectVisibleChanged.subscribe((_view, viewObject) => {
        if (this._viewManager === viewManager) {
          viewManager.viewObjectVisibilityChanged(viewObject);
        }
      }),
      viewerEvents.onViewObjectXRayedChanged.subscribe((_view, viewObject) => {
        if (this._viewManager === viewManager) {
          viewManager.viewObjectXRayedChanged(viewObject);
        }
      }),
      viewerEvents.onViewObjectClippableChanged.subscribe((_view, viewObject) => {
        if (this._viewManager === viewManager) {
          viewManager.viewObjectClippableChanged(viewObject);
        }
      }),
      viewerEvents.onViewObjectCulledChanged.subscribe((_view, viewObject) => {
        if (this._viewManager === viewManager) {
          viewManager.viewObjectCulledChanged(viewObject);
        }
      }),
      viewerEvents.onViewObjectHighlightedChanged.subscribe((_view, viewObject) => {
        if (this._viewManager === viewManager) {
          viewManager.viewObjectHighlightedChanged(viewObject);
        }
      }),
      viewerEvents.onViewObjectSelectedChanged.subscribe((_view, viewObject) => {
        if (this._viewManager === viewManager) {
          viewManager.viewObjectSelectedChanged(viewObject);
        }
      }),
      viewerEvents.onViewObjectColorizeChanged.subscribe((_view, viewObject) => {
        if (this._viewManager === viewManager) {
          viewManager.viewObjectColorizeChanged(viewObject);
        }
      }),
      viewerEvents.onViewObjectOpacityChanged.subscribe((_view, viewObject) => {
        if (this._viewManager === viewManager) {
          viewManager.viewObjectOpacityChanged(viewObject);
        }
      }),
      viewerEvents.onViewObjectPickableChanged.subscribe((_view, viewObject) => {
        if (this._viewManager === viewManager) {
          viewManager.viewObjectPickableChanged(viewObject);
        }
      }),
      viewerEvents.onEffectCreated.subscribe((_viewer, effect) => {
        if (this._viewManager === viewManager) {
          this._logError(viewManager.effectCreated(effect));
        }
      }),
      viewerEvents.onEffectDestroyed.subscribe((_viewer, effect) => {
        if (this._viewManager === viewManager) {
          this._logError(viewManager.effectDestroyed(effect));
        }
      }),
      viewerEvents.onCameraViewMatrixUpdated.subscribe((_view, camera) => {
        if (this._viewManager === viewManager) {
          viewManager.cameraViewMatrixUpdated(camera);
        }
      }),
      ...(viewerEvents.onCameraProjMatrixUpdated ? [
        viewerEvents.onCameraProjMatrixUpdated.subscribe((_view, camera) => {
          if (this._viewManager === viewManager) {
            viewManager.cameraProjMatrixUpdated(camera);
          }
        })
      ] : []),
      viewerEvents.onSectionPlaneCreated.subscribe((view) => {
        if (this._viewManager === viewManager) {
          viewManager.sectionPlanesChanged(view);
        }
      }),
      viewerEvents.onSectionPlaneDestroyed.subscribe((view) => {
        if (this._viewManager === viewManager) {
          viewManager.sectionPlanesChanged(view);
        }
      }),
      viewerEvents.onSectionPlanePosChanged.subscribe((sectionPlane) => {
        if (this._viewManager === viewManager) {
          viewManager.sectionPlanesChanged(sectionPlane.view);
        }
      }),
      viewerEvents.onSectionPlaneDirChanged.subscribe((sectionPlane) => {
        if (this._viewManager === viewManager) {
          viewManager.sectionPlanesChanged(sectionPlane.view);
        }
      }),
      viewerEvents.onSectionPlaneActive.subscribe((sectionPlane) => {
        if (this._viewManager === viewManager) {
          viewManager.sectionPlanesChanged(sectionPlane.view);
        }
      })
    ];

    const sceneEvents = this._viewer.scene?.events;
    if (!sceneEvents) {
      return;
    }

    this._viewManagerSubs.push(
      sceneEvents.onSceneModelCreated.subscribe((_scene, sceneModel) => {
        if (this._viewManager === viewManager) {
          this._logError(viewManager.sceneModelCreated(sceneModel));
        }
      }),
      sceneEvents.onSceneModelSealed.subscribe((_scene, sceneModel) => {
        if (this._viewManager === viewManager) {
          this._logError(viewManager.sceneModelSealed(sceneModel));
        }
      }),
      sceneEvents.onSceneModelDestroyed.subscribe((_scene, sceneModel) => {
        if (this._viewManager === viewManager) {
          this._deferredSceneModelRegistrations.delete(sceneModel);
          this._logError(viewManager.sceneModelDestroyed(sceneModel));
        }
      }),
      sceneEvents.onSceneModelBuildStarted.subscribe((_scene, sceneModel) => {
        if (this._viewManager === viewManager) {
          this._renderSuspendCount++;
          this._getDeferredSceneModelRegistrations(sceneModel);
        }
      }),
      sceneEvents.onSceneModelBuildFinished.subscribe((_scene, sceneModel) => {
        if (this._viewManager !== viewManager) {
          return;
        }
        this._flushDeferredSceneModelRegistrations(sceneModel, viewManager);
        if (this._renderSuspendCount > 0) {
          this._renderSuspendCount--;
        }
        if (this._renderSuspendCount === 0 && this._viewer) {
          const views = this._viewer.viewList;
          for (let i = 0, len = views.length; i < len; i++) {
            views[i]?.needsRender();
          }
        }
      }),
      sceneEvents.onSceneModelBatchStarted.subscribe((sceneModel) => {
        if (this._viewManager === viewManager) {
          this._renderSuspendCount++;
          this._getDeferredSceneModelRegistrations(sceneModel);
        }
      }),
      sceneEvents.onSceneModelBatchCommitted.subscribe((sceneModel, batch) => {
        if (this._viewManager !== viewManager) {
          return;
        }
        if (this._renderSuspendCount > 0) {
          this._renderSuspendCount--;
        }
        if (sceneModel.building) {
          return;
        }
        this._flushDeferredSceneModelRegistrations(sceneModel, viewManager, batch);
        if (this._renderSuspendCount === 0 && this._viewer) {
          const views = this._viewer.viewList;
          for (let i = 0, len = views.length; i < len; i++) {
            views[i]?.needsRender();
          }
        }
      }),
      sceneEvents.onSceneModelBatchRolledBack.subscribe((sceneModel) => {
        if (this._viewManager === viewManager) {
          this._deferredSceneModelRegistrations.delete(sceneModel);
          if (this._renderSuspendCount > 0) {
            this._renderSuspendCount--;
          }
        }
      }),
      sceneEvents.onSceneGeometryCreated.subscribe((_scene, sceneGeometry) => {
        if (this._viewManager === viewManager && !this._deferSceneGeometryCreated(sceneGeometry)) {
          this._logError(viewManager.sceneGeometryCreated(sceneGeometry));
        }
      }),
      sceneEvents.onSceneGeometryDestroyed.subscribe((_scene, sceneGeometry) => {
        if (this._viewManager === viewManager && !this._discardDeferredSceneGeometry(sceneGeometry)) {
          this._logError(viewManager.sceneGeometryDestroyed(sceneGeometry));
        }
      }),
      sceneEvents.onSceneGeometryUpdated.subscribe((_scene, sceneGeometry) => {
        if (this._viewManager === viewManager) {
          this._logError(viewManager.sceneGeometryUpdated(sceneGeometry));
        }
      }),
      sceneEvents.onSceneMeshCreated.subscribe((_scene, sceneMesh) => {
        if (this._viewManager === viewManager && !this._deferSceneMeshCreated(sceneMesh)) {
          this._logError(viewManager.sceneMeshCreated(sceneMesh));
        }
      }),
      sceneEvents.onSceneMeshDestroyed.subscribe((_scene, sceneMesh) => {
        if (this._viewManager === viewManager && !this._discardDeferredSceneMesh(sceneMesh)) {
          this._logError(viewManager.sceneMeshDestroyed(sceneMesh));
        }
      }),
      sceneEvents.onSceneObjectCreated.subscribe((_scene, sceneObject) => {
        if (this._viewManager === viewManager && !this._deferSceneObjectCreated(sceneObject)) {
          this._logError(viewManager.sceneObjectCreated(sceneObject));
        }
      }),
      sceneEvents.onSceneObjectDestroyed.subscribe((_scene, sceneObject) => {
        if (this._viewManager === viewManager && !this._discardDeferredSceneObject(sceneObject)) {
          this._logError(viewManager.sceneObjectDestroyed(sceneObject));
        }
      }),
      sceneEvents.onSceneObjectMeshAdded.subscribe((sceneObject, sceneMesh) => {
        if (this._viewManager === viewManager) {
          this._logError(viewManager.sceneObjectMeshAdded(sceneObject, sceneMesh));
        }
      }),
      sceneEvents.onSceneObjectMeshRemoved.subscribe((sceneObject, sceneMesh) => {
        if (this._viewManager === viewManager) {
          this._logError(viewManager.sceneObjectMeshRemoved(sceneObject, sceneMesh));
        }
      }),
      ...(sceneEvents.onSceneRepSetCreated ? [
        sceneEvents.onSceneRepSetCreated.subscribe((_sceneModel, repSet) => {
          if (this._viewManager === viewManager) {
            this._logError(viewManager.sceneRepSetCreated(repSet));
          }
        })
      ] : []),
      ...(sceneEvents.onSceneRepSetDestroyed ? [
        sceneEvents.onSceneRepSetDestroyed.subscribe((_sceneModel, repSet) => {
          if (this._viewManager === viewManager) {
            this._logError(viewManager.sceneRepSetDestroyed(repSet));
          }
        })
      ] : []),
      sceneEvents.onSceneMeshMatrixChanged.subscribe((_scene, sceneMesh) => {
        if (this._viewManager === viewManager) {
          viewManager.sceneMeshMatrixChanged(sceneMesh);
        }
      }),
      sceneEvents.onSceneMeshMoved.subscribe((_scene, sceneMesh) => {
        if (this._viewManager === viewManager) {
          viewManager.sceneMeshMoved(sceneMesh);
        }
      }),
      sceneEvents.onSceneMeshColorChanged.subscribe((_scene, sceneMesh) => {
        if (this._viewManager === viewManager) {
          viewManager.sceneMeshColorChanged(sceneMesh);
        }
      }),
      sceneEvents.onSceneMeshOpacityChanged.subscribe((_scene, sceneMesh) => {
        if (this._viewManager === viewManager) {
          viewManager.sceneMeshOpacityChanged(sceneMesh);
        }
      }),
      sceneEvents.onSceneMaterialPatternChanged.subscribe((_scene, sceneMaterial) => {
        if (this._viewManager === viewManager) {
          viewManager.sceneMaterialPatternChanged(sceneMaterial);
        }
      }),
      sceneEvents.onSceneMaterialColorChanged.subscribe((_scene, sceneMaterial) => {
        if (this._viewManager === viewManager) {
          viewManager.sceneMaterialColorChanged(sceneMaterial);
        }
      }),
      sceneEvents.onSceneMaterialEmissiveColorChanged.subscribe((_scene, sceneMaterial) => {
        if (this._viewManager === viewManager) {
          viewManager.sceneMaterialEmissiveColorChanged(sceneMaterial);
        }
      }),
      sceneEvents.onSceneMaterialOpacityChanged.subscribe((_scene, sceneMaterial) => {
        if (this._viewManager === viewManager) {
          viewManager.sceneMaterialOpacityChanged(sceneMaterial);
        }
      }),
      sceneEvents.onSceneTextureImageDataChanged.subscribe((_scene, sceneTexture) => {
        if (this._viewManager === viewManager) {
          viewManager.sceneTextureImageDataChanged(sceneTexture);
        }
      }),
      sceneEvents.onSceneTransformMatrixChanged.subscribe((_scene, sceneTransform) => {
        if (this._viewManager === viewManager) {
          viewManager.sceneTransformMatrixChanged(sceneTransform);
        }
      })
    );
  }

  private _destroyViewManager(emitEvent = true): void {
    const viewManager = this._viewManager;
    if (!viewManager) {
      return;
    }

    this._unsubscribeViewManager();

    viewManager.destroy();
    this._viewManager = null;
    this._renderSuspendCount = 0;
    this._deferredSceneModelRegistrations.clear();

    if (emitEvent) {
      this.events.onRendererStopped.dispatch(this);
    }
  }

  private _unsubscribeViewManager(): void {
    for (const sub of this._viewManagerSubs) {
      sub();
    }
    this._viewManagerSubs = [];
  }

  private static _createDeviceDescriptor(params: {
    descriptor?: WebGPUDeviceDescriptor;
    adapter: WebGPUAdapterLike;
    gpuTimestamps: boolean;
  }): WebGPUDeviceDescriptor | undefined {
    const timestampQuerySupported = params.gpuTimestamps && params.adapter.features?.has?.("timestamp-query");
    const multiDrawIndirectSupported = params.adapter.features?.has?.(WEBGPU_MULTI_DRAW_INDIRECT_FEATURE);
    const adapterMaxStorageBufferBindingSize = params.adapter.limits?.maxStorageBufferBindingSize;
    const elevatedMaxStorageBufferBindingSize = Number.isFinite(adapterMaxStorageBufferBindingSize) &&
      adapterMaxStorageBufferBindingSize! > WEBGPU_DEFAULT_MAX_STORAGE_BUFFER_BINDING_SIZE
        ? Math.floor(adapterMaxStorageBufferBindingSize!)
        : undefined;
    if (!timestampQuerySupported && !multiDrawIndirectSupported && elevatedMaxStorageBufferBindingSize === undefined) {
      return params.descriptor;
    }
    const descriptor = {
      ...((params.descriptor ?? {}) as object)
    } as {
      requiredFeatures?: string[];
      requiredLimits?: {
        maxStorageBufferBindingSize?: number;
      };
    };
    const requiredFeatures = new Set(descriptor.requiredFeatures ?? []);
    if (timestampQuerySupported) {
      requiredFeatures.add("timestamp-query");
    }
    if (multiDrawIndirectSupported) {
      requiredFeatures.add(WEBGPU_MULTI_DRAW_INDIRECT_FEATURE);
    }
    if (requiredFeatures.size > 0) {
      descriptor.requiredFeatures = Array.from(requiredFeatures);
    }
    if (elevatedMaxStorageBufferBindingSize !== undefined) {
      descriptor.requiredLimits = {
        ...(descriptor.requiredLimits ?? {}),
        maxStorageBufferBindingSize: Math.max(
          descriptor.requiredLimits?.maxStorageBufferBindingSize ?? 0,
          elevatedMaxStorageBufferBindingSize
        )
      };
    }
    return descriptor;
  }

  private _watchDeviceLost(): void {
    const lost = this._device?.lost;
    if (!lost || typeof lost.then !== "function") {
      return;
    }
    const token = {};
    this._deviceLostWatchToken = token;
    lost.then((info) => {
      if (this._deviceLostWatchToken !== token || this._destroyed) {
        return;
      }
      this._handleDeviceLost(info);
    }).catch((e) => {
      if (this._deviceLostWatchToken !== token || this._destroyed) {
        return;
      }
      this._handleDeviceLost({
        message: e instanceof Error ? e.message : String(e)
      });
    });
  }

  private _handleDeviceLost(info?: WebGPUDeviceLostInfoLike): void {
    this._deviceLost = true;
    this._destroyViewManager();
    const event = typeof Event !== "undefined"
      ? new Event("webgpudevicelost")
      : ({type: "webgpudevicelost"} as Event);
    this.events.onContextLost.dispatch(this, event);
    const detail = info?.message ? ` ${info.message}` : "";
    this._error(
      SDKErrorType.InvalidOperation,
      `[WebGPURenderer.deviceLost] WebGPU device was lost.${detail}`
    );
  }

  private _error<T>(type: SDKErrorType, error: string): SDKResult<T> {
    return this._logError({
      ok: false,
      type,
      error
    });
  }

  private _logError<T>(result: SDKResult<T>): SDKResult<T> {
    if (result.ok === false) {
      const rendererError: RendererError = {
        ok: false,
        type: result.type,
        error: `[WebGPURenderer] ${result.error}`
      };
      if (this.logging) {
        console.error(rendererError.error);
      }
      this.events.onError.dispatch(this, rendererError);
    }
    return result;
  }
}
