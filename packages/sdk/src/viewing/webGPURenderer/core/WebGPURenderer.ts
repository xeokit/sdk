import {EventDispatcher} from "strongly-typed-events";
import {EventEmitter, SDKErrorType, type SDKResult} from "../../../base/core";
import type {Renderer, RendererError} from "../../renderer";
import type {PickParams, PickResult, View, Viewer} from "../../viewer";
import type {WebGPURendererEvents} from "./WebGPURendererEvents";
import type {WebGPURendererParams} from "./WebGPURendererParams";

type GlobalWithOptionalWebGPU = typeof globalThis & {
  navigator?: {
    gpu?: unknown;
  };
};

/**
 * WebGPU renderer backend.
 *
 * This initial implementation establishes the public renderer shape and
 * WebGPU feature detection. The actual WebGPU rendering pipeline is not wired
 * yet, so Viewer attachment and renderer-backed operations return
 * {@link base!core.SDKErrorType.NotSupported}.
 */
export class WebGPURenderer implements Renderer {

  private _viewer: Viewer | null = null;
  private _destroyed = false;

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
    if (params.viewer) {
      this.attachViewer(params.viewer);
    }
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
    return false;
  }

  /**
   * Whether the current runtime exposes the browser WebGPU entry point.
   */
  public get supported(): boolean {
    return WebGPURenderer.isSupported();
  }

  /**
   * Attaches a Viewer to this renderer.
   *
   * The WebGPU backend does not yet have a rendering pipeline, so this returns
   * {@link base!core.SDKErrorType.NotSupported} without mutating renderer
   * attachment state.
   *
   * @param viewer - Viewer to attach.
   * @returns An SDK result describing why attachment is not available yet.
   */
  public attachViewer(viewer: Viewer): SDKResult<void> {
    void viewer;

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

    if (!WebGPURenderer.isSupported()) {
      return this._error(
        SDKErrorType.NotSupported,
        "[WebGPURenderer.attachViewer] WebGPU is not available in this runtime."
      );
    }

    return this._error(
      SDKErrorType.NotSupported,
      "[WebGPURenderer.attachViewer] WebGPU rendering is not implemented yet."
    );
  }

  /**
   * Detaches the current Viewer, if any.
   */
  public detachViewer(): void {
    if (!this._viewer) {
      return;
    }
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

  private static _getGPU(): unknown | null {
    return ((globalThis as GlobalWithOptionalWebGPU).navigator?.gpu) ?? null;
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
