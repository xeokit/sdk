import {EventDispatcher} from "strongly-typed-events";
import {EventEmitter, SDKErrorType, type SDKResult} from "../../../base/core";
import type {Renderer, RendererError} from "../../renderer";
import type {PickParams, PickResult, View, Viewer} from "../../viewer";
import {type GlobalWithOptionalWebGPU, WebGPUViewManager, type WebGPUNavigatorLike} from "../internal";
import type {WebGPURendererEvents} from "./WebGPURendererEvents";
import type {
  WebGPUAdapterLike,
  WebGPUCanvasAlphaMode,
  WebGPUDeviceLike,
  WebGPUDeviceLostInfoLike,
  WebGPURendererParams
} from "./WebGPURendererParams";

/**
 * WebGPU renderer backend.
 *
 * This public class owns viewer attachment, event wiring, device acquisition,
 * and backend-neutral renderer contracts. Per-view WebGPU canvas state, GPU
 * buffers, pipelines, and draw submission are owned by the internal
 * {@link WebGPUViewManager}, matching the composition used by WebGLRenderer.
 */
export class WebGPURenderer implements Renderer {

  private _viewer: Viewer | null = null;
  private _viewerSubs: (() => void)[] = [];
  private _viewManagerSubs: (() => void)[] = [];
  private _viewManager: WebGPUViewManager | null = null;
  private _destroyed = false;
  private _deviceLost = false;
  private _deviceLostWatchToken: object | null = null;
  private _device: WebGPUDeviceLike | null;
  private readonly _contextFormat: string;
  private readonly _alphaMode?: WebGPUCanvasAlphaMode;
  private readonly _destroyDeviceOnDestroy: boolean;

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

        device = await adapter.requestDevice(params.deviceDescriptor);
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
   * Picking is not implemented until the WebGPU rendering pipeline exists.
   *
   * @param view - View whose canvas coordinates are being picked.
   * @param pickParams - Picking options and canvas coordinates.
   * @returns An SDK error result.
   */
  public pick(view: View, pickParams: PickParams): SDKResult<PickResult> {
    void pickParams;

    if (!this._viewer) {
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

    return this._error(
      SDKErrorType.NotSupported,
      "[WebGPURenderer.pick] WebGPU picking is not implemented yet."
    );
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

    const viewManager = new WebGPUViewManager();
    const result = viewManager.init({
      viewer: this._viewer,
      device: this._device,
      contextFormat: this._contextFormat,
      alphaMode: this._alphaMode
    });

    if (result.ok === false) {
      viewManager.destroy();
      return result;
    }

    this._viewManager = viewManager;
    this._subscribeViewManager(viewManager);

    return {
      ok: true,
      value: undefined
    };
  }

  private _subscribeViewManager(viewManager: WebGPUViewManager): void {
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
          this.events.onViewRendered.dispatch(this, view);
        }
      }),
      viewerEvents.onViewUpdated.subscribe((_view, view) => {
        if (this._viewManager !== viewManager) {
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
          viewManager.viewObjectChanged(viewObject);
        }
      }),
      viewerEvents.onViewObjectCulledChanged.subscribe((_view, viewObject) => {
        if (this._viewManager === viewManager) {
          viewManager.viewObjectChanged(viewObject);
        }
      }),
      viewerEvents.onViewObjectColorizeChanged.subscribe((_view, viewObject) => {
        if (this._viewManager === viewManager) {
          viewManager.viewObjectChanged(viewObject);
        }
      }),
      viewerEvents.onViewObjectOpacityChanged.subscribe((_view, viewObject) => {
        if (this._viewManager === viewManager) {
          viewManager.viewObjectChanged(viewObject);
        }
      })
    ];

    const sceneEvents = this._viewer.scene?.events;
    if (!sceneEvents) {
      return;
    }

    this._viewManagerSubs.push(
      sceneEvents.onSceneMeshCreated.subscribe((_scene, sceneMesh) => {
        if (this._viewManager === viewManager) {
          this._logError(viewManager.sceneMeshCreated(sceneMesh));
        }
      }),
      sceneEvents.onSceneMeshDestroyed.subscribe((_scene, sceneMesh) => {
        if (this._viewManager === viewManager) {
          viewManager.sceneMeshDestroyed(sceneMesh);
        }
      }),
      sceneEvents.onSceneGeometryDestroyed.subscribe((_scene, sceneGeometry) => {
        if (this._viewManager === viewManager) {
          viewManager.sceneGeometryDestroyed(sceneGeometry);
        }
      }),
      sceneEvents.onSceneMeshMatrixChanged.subscribe(() => {
        if (this._viewManager === viewManager) {
          viewManager.sceneMeshChanged();
        }
      }),
      sceneEvents.onSceneMeshMoved.subscribe(() => {
        if (this._viewManager === viewManager) {
          viewManager.sceneMeshChanged();
        }
      }),
      sceneEvents.onSceneMeshColorChanged.subscribe(() => {
        if (this._viewManager === viewManager) {
          viewManager.sceneMeshChanged();
        }
      }),
      sceneEvents.onSceneMeshOpacityChanged.subscribe(() => {
        if (this._viewManager === viewManager) {
          viewManager.sceneMeshChanged();
        }
      })
    );
  }

  private _destroyViewManager(emitEvent = true): void {
    const viewManager = this._viewManager;
    if (!viewManager) {
      return;
    }

    for (const sub of this._viewManagerSubs) {
      sub();
    }
    this._viewManagerSubs = [];

    viewManager.destroy();
    this._viewManager = null;

    if (emitEvent) {
      this.events.onRendererStopped.dispatch(this);
    }
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
